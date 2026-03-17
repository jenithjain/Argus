const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const fixes = {
  NEXTAUTH_SECRET: '39dafb79cdda6f039dba00cfd94709fb95c43188b8b80cf3f9e93dca6168f1d2',
  NEXTAUTH_URL: 'https://argus-dashboard-tan.vercel.app'
};

async function fixEnv(key, value, envName) {
  try { await execAsync(`npx vercel env rm ${key} ${envName} -y`, { cwd: 'ARGUS' }); } catch(e) {}
  try {
    const b64 = Buffer.from(value).toString('base64');
    await execAsync(`node -e "process.stdout.write(Buffer.from('${b64}', 'base64').toString())" | npx vercel env add ${key} ${envName}`, { cwd: 'ARGUS' });
    console.log(`Fixed ${key} in ${envName}`);
  } catch(e) {
    console.error(`Failed ${key} in ${envName}: ${e.message}`);
  }
}

async function run() {
  const promises = [];
  for (const [key, value] of Object.entries(fixes)) {
    promises.push(fixEnv(key, value, 'production'));
    promises.push(fixEnv(key, value, 'development'));
  }
  await Promise.all(promises);
  console.log('All fixes applied!');
}
run();
