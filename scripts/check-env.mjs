const baseRequired=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY'];
const missing=baseRequired.filter(key=>!process.env[key]?.trim());
const hasVisionKey=Boolean(process.env.GEMINI_API_KEY?.trim()||process.env.OPENAI_API_KEY?.trim());
for(const key of baseRequired)console.log(`${key}: ${missing.includes(key)?'missing':'configured'}`);
console.log(`VISION_API_KEY (GEMINI or OPENAI): ${hasVisionKey?'configured ('+(process.env.GEMINI_API_KEY?'GEMINI_API_KEY':'OPENAI_API_KEY')+')':'missing'}`);
if(process.env.NEXT_PUBLIC_SUPABASE_URL){try{const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);if(url.protocol!=='https:')throw Error();}catch{console.error('Supabase URL must be a valid HTTPS URL.');process.exitCode=1;}}
if(missing.length||!hasVisionKey)process.exitCode=1;
