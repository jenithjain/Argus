const fs = require('fs');
const path = require('path');

async function updateRootDirectory() {
  try {
    // Read the Vercel authentication token
    const authPath = path.join(process.env.APPDATA, 'com.vercel.cli', 'Data', 'auth.json');
    if (!fs.existsSync(authPath)) {
      console.error('Vercel auth.json not found at', authPath);
      return;
    }
    
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const token = auth.token;
    
    // The Project ID from your .vercel/project.json
    const projectId = 'prj_8tr9Uq1zeKFo5z1OFHSNxFsiJLfu'; 
    
    console.log('Updating Vercel project Root Directory to "ARGUS"...');
    
    const response = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rootDirectory: null // Clear for CLI deploy from ARGUS folder
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Successfully updated Root Directory!');
      console.log('Current framework:', data.framework);
      console.log('Current rootDirectory:', data.rootDirectory);
    } else {
      console.error('Failed to update project:', data);
    }
  } catch (error) {
    console.error('Error occurred:', error);
  }
}

updateRootDirectory();
