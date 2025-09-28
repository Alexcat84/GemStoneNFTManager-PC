#!/usr/bin/env node

const https = require('https');

// URLs de Deploy Hooks (reemplaza con las tuyas)
const DEPLOY_HOOKS = {
  qrGenerator: process.env.VERCEL_DEPLOY_HOOK_QR || 'TU_DEPLOY_HOOK_URL_QR_GENERATOR',
  mainWebsite: process.env.VERCEL_DEPLOY_HOOK_MAIN || 'TU_DEPLOY_HOOK_URL_MAIN_WEBSITE'
};

async function triggerDeploy(url, name) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST' }, (res) => {
      console.log(`✅ ${name} deployment triggered - Status: ${res.statusCode}`);
      resolve(res.statusCode);
    });

    req.on('error', (error) => {
      console.error(`❌ Error triggering ${name} deployment:`, error.message);
      reject(error);
    });

    req.end();
  });
}

async function forceDeployAll() {
  console.log('🚀 Forcing deployments for both projects...\n');

  try {
    // Deploy QR Generator
    await triggerDeploy(DEPLOY_HOOKS.qrGenerator, 'QR Generator');
    
    // Deploy Main Website
    await triggerDeploy(DEPLOY_HOOKS.mainWebsite, 'Main Website');
    
    console.log('\n🎉 All deployments triggered successfully!');
    console.log('📊 Check Vercel dashboard for deployment status.');
    
  } catch (error) {
    console.error('\n❌ Failed to trigger deployments:', error.message);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  forceDeployAll();
}

module.exports = { forceDeployAll, triggerDeploy };
