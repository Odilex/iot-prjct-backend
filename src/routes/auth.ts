import { Router, Response, Request } from 'express';
import { supabase } from '../config/supabase';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

import prisma from '../config/database';

const router = Router();

/**
 * POST /api/auth/login (Dashboard Login for Staff)
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, phone, password } = req.body;
        const fs = require('fs');
        const logMsg = `[${new Date().toISOString()}] Login attempt: Email=${email}, Phone=${phone}, Body=${JSON.stringify(req.body)}\n`;
        fs.appendFileSync('login_debug.log', logMsg);
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
        const { phone, password } = req.body;

        // Log to file as well
        const fs = require('fs');
        const logMsg = `[${new Date().toISOString()}] Parent Login attempt: Phone=${phone}, Body=${JSON.stringify(req.body)}\n`;
        fs.appendFileSync('login_debug.log', logMsg);

        console.log(`[Auth] Parent login attempt for phone: ${phone}`);

        if (!phone || !password) {
            console.log('[Auth] Parent login failed: Missing phone or password');
            res.status(400).json({ error: 'Phone and password are required' });
            return;
        }

        // Normalize phone for Supabase
        // We will try both with and without the '+' prefix because some accounts 
        // in this project seem to have been created without it (e.g., 250... instead of +250...)
        let primaryPhone = phone;
        let secondaryPhone = '';

        if (phone.startsWith('+')) {
            primaryPhone = phone;
            secondaryPhone = phone.substring(1); // e.g. +250... -> 250...
        } else if (phone.startsWith('0')) {
            primaryPhone = `+250${phone.substring(1)}`;
            secondaryPhone = `250${phone.substring(1)}`;
        } else if (phone.startsWith('250')) {
            primaryPhone = `+${phone}`;
            secondaryPhone = phone;
        }

        console.log(`[Auth] Normalized phones: primary=${primaryPhone}, secondary=${secondaryPhone}`);

        // 1. Check if ANY version of the phone exists in parents table
        const localPhone = phone.startsWith('+250') ? '0' + phone.substring(4) : (phone.startsWith('250') ? '0' + phone.substring(3) : phone);
        console.log(`[Auth] Searching for parent with: ${phone} OR ${localPhone} OR ${primaryPhone} OR ${secondaryPhone}`);

        const parentRecord = await prisma.parent.findFirst({
            where: {
                OR: [
                    { phone_number: phone },
                    { phone_number: localPhone },
                    { phone_number: primaryPhone },
                    { phone_number: secondaryPhone }
                ]
            }
        });


        if (!parentRecord) {
            console.log(`[Auth] Parent record not found for phone: ${phone}`);
            res.status(403).json({ error: 'Forbidden', message: 'Phone number not registered in school records' });
            return;
        }

        console.log(`[Auth] Found parent record: ${parentRecord.full_name}, ID: ${parentRecord.id}, UserId: ${parentRecord.userId}`);

        // 2. Authenticate or Sign Up with Supabase
        let authResponse;

        if (!parentRecord.userId) {
            console.log(`[Auth] Auto-registering parent with Supabase: ${primaryPhone}`);
            authResponse = await supabase.auth.signUp({
                phone: primaryPhone,
                password: password,
            });

            if (authResponse.error && (authResponse.error.message.includes('already registered') || authResponse.error.status === 400)) {
                console.log(`[Auth] Parent already registered or signUp failed, trying sign in with ${primaryPhone}`);
                authResponse = await supabase.auth.signInWithPassword({
                    phone: primaryPhone,
                    password: password
                });

                // If primary fails, try secondary
                if (authResponse.error && secondaryPhone) {
                    console.log(`[Auth] Sign in failed with ${primaryPhone}, trying ${secondaryPhone}`);
                    authResponse = await supabase.auth.signInWithPassword({
                        phone: secondaryPhone,
                        password: password
                    });
                }
            }
        } else {
            console.log(`[Auth] Parent already has userId, attempting sign in with Supabase: ${primaryPhone}`);
            authResponse = await supabase.auth.signInWithPassword({
                phone: primaryPhone,
                password: password
            });

            // If primary fails, try secondary (sometimes accounts are created without the + prefix)
            if (authResponse.error && secondaryPhone) {
                console.log(`[Auth] Sign in failed with ${primaryPhone}, trying ${secondaryPhone} instead...`);
                authResponse = await supabase.auth.signInWithPassword({
                    phone: secondaryPhone,
                    password: password
                });
            }
        }

        const { data, error } = authResponse;

        if (error) {
            console.error(`[Auth] Parent Supabase error: ${error.message} (Status: ${error.status})`);
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

