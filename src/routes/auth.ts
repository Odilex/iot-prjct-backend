import { Router, Response, Request } from 'express';
import { supabase } from '../config/supabase';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

import prisma from '../config/database';
import { safeLogToFile } from '../utils/logger';

const router = Router();

/**
 * POST /api/auth/login (Dashboard Login for Staff)
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, phone, password } = req.body;
        const logMsg = `[${new Date().toISOString()}] Login attempt: Email=${email}, Phone=${phone}, Body=${JSON.stringify(req.body)}\n`;
        safeLogToFile('login_debug.log', logMsg);
        console.log('[Auth] Full request body:', JSON.stringify(req.body));

        if ((!email && !phone) || !password) {
            res.status(400).json({ error: 'Email/Phone and password are required' });
            return;
        }

        let loginPayload: any = { password };
        if (email) loginPayload.email = email;
        else loginPayload.phone = phone;

        console.log(`[Auth] Attempting dashboard login for: ${email || phone}`);
        console.log(`[Auth] Payload keys: ${Object.keys(loginPayload)}`);
        const { data, error } = await supabase.auth.signInWithPassword(loginPayload);

        if (error) {
            console.error(`[Auth] Supabase login failed: ${error.message} (Status: ${error.status})`);
            res.status(401).json({ error: 'Invalid credentials', message: error.message });
            return;
        }

        // Dashboard login is ONLY for Staff
        let staff = await prisma.staff.findFirst({
            where: {
                OR: [
                    { userId: data.user.id },
                    { email: email || '' },
                    { phone: phone || '' }
                ]
            }
        });

        if (!staff) {
            console.error(`[Auth] No staff record found for ID: ${data.user.id} or Email: ${email}`);
            res.status(403).json({ error: 'Forbidden', message: 'This login is for school authorities only' });
            return;
        }

        // Auto-link staff record if userId is missing or different
        if (!staff.userId || staff.userId !== data.user.id) {
            staff = await prisma.staff.update({
                where: { id: staff.id },
                data: { userId: data.user.id }
            });
        }

        const role = staff.role || 'teacher';
        const name = staff.full_name;

        res.json({
            token: data.session?.access_token,
            user: {
                id: data.user?.id,
                email: data.user?.email,
                phone: data.user?.phone,
                name,
                role,
            },
        });
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/auth/parent/login (Parent Portal Login)
 */
router.post('/parent/login', async (req: Request, res: Response) => {
    try {
        let { email, phone, phoneNumber, password } = req.body;
        // Support both field names for compatibility
        if (!phone && phoneNumber) phone = phoneNumber;

        // Log to file as well
        const attemptMsg = `[${new Date().toISOString()}] Parent Login attempt: Email=${email}, Phone=${phone}, Body=${JSON.stringify(req.body)}\n`;
        safeLogToFile('login_debug.log', attemptMsg);

        console.log(`[Auth] Parent login attempt for: ${email || phone}`);

        if ((!email && !phone) || !password) {
            console.log('[Auth] Parent login failed: Missing credentials');
            res.status(400).json({ error: 'Email/Phone and password are required' });
            return;
        }

        // 1. Find parent record first
        let parentRecord = await prisma.parent.findFirst({
            where: {
                OR: [
                    { email: email || '___never_match___' },
                    { phone_number: phone || '___never_match___' }
                ]
            }
        });

        // Special case: if phone was provided, try normalized versions
        if (!parentRecord && phone) {
            const primaryPhone = phone.startsWith('+') ? phone : (phone.startsWith('0') ? `+250${phone.substring(1)}` : `+${phone}`);
            const secondaryPhone = phone.startsWith('+') ? phone.substring(1) : (phone.startsWith('0') ? `250${phone.substring(1)}` : phone);
            const localPhone = phone.startsWith('0') ? phone : (phone.startsWith('+250') ? '0' + phone.substring(4) : (phone.startsWith('250') ? '0' + phone.substring(3) : phone));

            console.log(`[Auth] Retrying parent search with normalized phones: ${primaryPhone}, ${secondaryPhone}, ${localPhone}`);

            parentRecord = await prisma.parent.findFirst({
                where: {
                    OR: [
                        { phone_number: phone },
                        { phone_number: primaryPhone },
                        { phone_number: secondaryPhone },
                        { phone_number: localPhone }
                    ]
                }
            });
        }

        if (!parentRecord) {
            console.log(`[Auth] Parent record not found for: ${email || phone}`);
            safeLogToFile('login_debug.log', `[${new Date().toISOString()}] Parent record NOT FOUND for: ${email || phone}\n`);
            res.status(403).json({ error: 'Forbidden', message: 'User not registered as a parent in school records' });
            return;
        }

        console.log(`[Auth] Found parent record: ${parentRecord.full_name}, ID: ${parentRecord.id}, UserId: ${parentRecord.userId}`);
        safeLogToFile('login_debug.log', `[${new Date().toISOString()}] Found parent: ${parentRecord.full_name}, UserId: ${parentRecord.userId}\n`);

        // 2. Authenticate with Supabase
        const loginPayload: any = { password };
        if (email) loginPayload.email = email;
        else {
            // Use normalized phone if available, else use raw
            const nPhone = phone?.startsWith('0') ? `+250${phone.substring(1)}` : (phone?.startsWith('250') ? `+${phone}` : phone);
            loginPayload.phone = nPhone;
        }

        console.log(`[Auth] Attempting Supabase login for parent: ${email || loginPayload.phone}`);
        let authResponse: any = await supabase.auth.signInWithPassword(loginPayload);

        // If first attempt fails and it was phone, try without the '+' or with original
        if (authResponse.error && loginPayload.phone) {
            const alternatePhone = loginPayload.phone.startsWith('+') ? loginPayload.phone.substring(1) : `+${loginPayload.phone}`;
            console.log(`[Auth] Sign in failed, retrying with alternate phone: ${alternatePhone}`);
            authResponse = await supabase.auth.signInWithPassword({ phone: alternatePhone, password });
        }

        // 3. Fallback: If login fails but parent exists, try to signUp (auto-creation)
        if (authResponse.error && (authResponse.error.status === 400 || authResponse.error.message.includes('Invalid login') || authResponse.error.message.includes('OTP'))) {
            if (!parentRecord.userId) {
                console.log(`[Auth] Login failed or OTP required, but parent exists. Attempting auto-signUp with EMAIL to bypass SMS...`);

                // We use the email from the DB record even if they typed their phone
                // because Supabase phone auth often requires SMS setup (Twilio)
                const supabaseEmail = parentRecord.email || `parent_${parentRecord.id}@school.com`;

                console.log(`[Auth] Registering ${parentRecord.full_name} with Supabase Email: ${supabaseEmail}`);

                authResponse = await supabase.auth.signUp({
                    email: supabaseEmail,
                    password: password
                });

                if (authResponse.error) {
                    console.error(`[Auth] Auto-signUp failed: ${authResponse.error.message}`);
                } else if (authResponse.data?.user) {
                    console.log(`[Auth] Successfully registered parent in Supabase. Linking userId...`);
                    await prisma.parent.update({
                        where: { id: parentRecord.id },
                        data: { userId: authResponse.data.user.id }
                    });
                }
            }
        }

        const { data, error } = authResponse;

        if (error) {
            console.error(`[Auth] Parent Supabase error: ${error.message} (Status: ${error.status})`);
            safeLogToFile('login_debug.log', `[${new Date().toISOString()}] Parent Supabase ERROR: ${error.message} (Status: ${error.status})\n`);
            res.status(error.status || 401).json({ error: 'Authentication failed', message: error.message });
            return;
        }

        if (!data.user) {
            console.log('[Auth] No user data returned from Supabase');
            res.status(401).json({ error: 'Authentication failed', message: 'No user data returned' });
            return;
        }

        console.log(`[Auth] Parent successfully authenticated. Supabase ID: ${data.user.id}`);


        // 3. Link userId if not already linked (or update if different)
        if (!parentRecord.userId || parentRecord.userId !== data.user.id) {
            await prisma.parent.update({
                where: { id: parentRecord.id },
                data: { userId: data.user.id }
            });
        }

        res.json({
            token: data.session?.access_token,
            user: {
                id: data.user?.id,
                phone: data.user?.phone,
                name: parentRecord.full_name,
                role: 'parent',
            },
        });
    } catch (error) {
        console.error('[Auth] Parent login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/auth/dev-login (TEMPORARY FOR TESTING)
 * Allows login without password verification for a specific email
 */
router.post('/dev-login', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const staff = await prisma.staff.findFirst({ where: { email } });

        if (!staff) {
            res.status(404).json({ error: 'Staff not found' });
            return;
        }

        res.json({
            token: 'dev-token-bypass',
            user: {
                id: staff.userId,
                email: staff.email,
                name: staff.full_name,
                role: staff.role,
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Dev login error' });
    }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', async (_req: Request, res: Response) => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            res.status(500).json({ error: 'Logout failed', message: error.message });
            return;
        }
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('[Auth] Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/auth/me
 * GET /api/auth/profile
 */
const getProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const userId = req.user.id;
        let profile: any = {
            id: userId,
            email: req.user.email,
        };

        // Try staff
        const staff = await prisma.staff.findFirst({ where: { userId } });
        if (staff) {
            profile = { ...profile, ...staff, role: staff.role || 'teacher' };
        } else {
            // Try parent
            const parent = await prisma.parent.findFirst({
                where: { userId },
                include: { parentStudentMaps: { include: { student: true } } }
            });
            if (parent) {
                profile = { ...profile, ...parent, role: 'parent' };
            }
        }

        res.json({ user: profile });
    } catch (error) {
        console.error('[Auth] Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

router.get('/me', authenticateJWT, getProfile);
router.get('/profile', authenticateJWT, getProfile);

export default router;

