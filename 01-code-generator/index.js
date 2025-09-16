const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const GemStoneCodeDatabase = require('./src/database/database.js');
const CodeGenerator = require('./src/utils/codeGenerator.js');

let mainWindow;
let database;
let codeGenerator;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Optional icon
    title: 'GemStone NFT Code Generator'
  });

  // Load the HTML file
  mainWindow.loadFile('src/renderer/index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Initialize database and code generator when app is ready
app.whenReady().then(() => {
  database = new GemStoneCodeDatabase();
  codeGenerator = new CodeGenerator();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for gemstone operations (removed - now using free text input)

// IPC handlers for location operations
ipcMain.handle('get-locations', async () => {
  try {
    return await database.getAllLocations();
  } catch (error) {
    console.error('Error getting locations:', error);
    return [];
  }
});

ipcMain.handle('add-location', async (event, province, country, region) => {
  try {
    return await database.addLocation(province, country, region);
  } catch (error) {
    console.error('Error adding location:', error);
    throw error;
  }
});

// IPC handlers for code generation
ipcMain.handle('generate-code', async (event, gemstoneNames, locationId, month, year, notes) => {
  try {
    // Get next correlative number
    const pieceNumber = await database.getNextCorrelative(gemstoneNames, month, year);
    
    // Generate the code
    const fullCode = codeGenerator.generateCode(gemstoneNames, month, year, pieceNumber);
    const checksum = codeGenerator.generateChecksum(gemstoneNames.join(','), month, year, pieceNumber);
    
    // Generate gemstone codes
    const gemstoneCodes = gemstoneNames.map(name => codeGenerator.getGemstoneCode(name));
    
    // Prepare code data
    const codeData = {
      full_code: fullCode,
      gemstone_names: JSON.stringify(gemstoneNames),
      gemstone_codes: JSON.stringify(gemstoneCodes),
      location_id: locationId,
      piece_number: pieceNumber,
      month: month,
      year: year,
      checksum: checksum,
      notes: notes || ''
    };
    
    // Save to database
    const result = await database.addGeneratedCode(codeData);
    
    return {
      ...result,
      gemstoneNames,
      pieceNumber,
      fullCode
    };
  } catch (error) {
    console.error('Error generating code:', error);
    throw error;
  }
});

ipcMain.handle('get-generated-codes', async () => {
  try {
    return await database.getAllGeneratedCodes();
  } catch (error) {
    console.error('Error getting generated codes:', error);
    return [];
  }
});

ipcMain.handle('search-codes', async (event, query) => {
  try {
    return await database.searchGeneratedCodes(query);
  } catch (error) {
    console.error('Error searching codes:', error);
    return [];
  }
});

ipcMain.handle('verify-code', async (event, fullCode, gemstoneCodes, month, year, pieceNumber) => {
  try {
    return codeGenerator.verifyCode(fullCode, gemstoneCodes, month, year, pieceNumber);
  } catch (error) {
    console.error('Error verifying code:', error);
    return false;
  }
});

ipcMain.handle('parse-code', async (event, fullCode) => {
  try {
    return codeGenerator.parseCode(fullCode);
  } catch (error) {
    console.error('Error parsing code:', error);
    return null;
  }
});

ipcMain.handle('get-next-correlative', async (event, gemstoneCodes, month, year) => {
  try {
    return await database.getNextCorrelative(gemstoneCodes, month, year);
  } catch (error) {
    console.error('Error getting next correlative:', error);
    return 1;
  }
});

ipcMain.handle('get-stats', async () => {
  try {
    return await database.getStats();
  } catch (error) {
    console.error('Error getting stats:', error);
    return {};
  }
});

ipcMain.handle('generate-qr-data', async (event, fullCode, metadata) => {
  try {
    return codeGenerator.generateQRData(fullCode, metadata);
  } catch (error) {
    console.error('Error generating QR data:', error);
    return '';
  }
});
