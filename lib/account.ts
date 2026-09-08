import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db} from '@/lib/server';
export async function account(){const user=await getChatGPTUser();if(!user)return {user:null,profile:null};const row:any=await db().prepare('SELECT * FROM users WHERE id=?').bind(user.userId).first();return {user,profile:row?{...row,preferences:JSON.parse(row.preferences)}:null};}
