import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_ANON_ROLE_KEY!; // service_role key

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function finalReset() {
    const phone = '250788357288';
    const newPassword = 'ParentPortal';

    console.log(`Searching for user with phone: ${phone}`);

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('List error:', error);
        return;
    }

    const user = users.find(u => u.phone === phone);

    if (user) {
        console.log(`User found: ${user.id}. Resetting password...`);
        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
            password: newPassword
        });

        if (updateError) {
            console.error('Update error:', updateError.message);
        } else {
            console.log(`✅ Success! The real password is now: ${newPassword}`);
        }
    } else {
        console.log('User not found!');
    }
}

finalReset();
