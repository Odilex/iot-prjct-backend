import { Router, Response, Request } from 'express';
import { supabase } from '../config/supabase';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            res.status(401).json({ error: 'Invalid credentials', message: error.message });
            return;
        }

        // Get user details (role etc) from staff/parent tables if needed
        // For now returning the basic user
        res.json({
            token: data.session?.access_token,
            user: {
                id: data.user?.id,
                email: data.user?.email,
                name: data.user?.user_metadata?.full_name || data.user?.email?.split('@')[0],
                role: data.user?.user_metadata?.role || 'user',
            },
        });
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
 */
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Optionally fetch full profile from DB
        res.json({
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.email?.split('@')[0], // Placeholder
                role: 'admin', // Placeholder
            },
        });
    } catch (error) {
        console.error('[Auth] Me error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
