# 💎 GemStone NFT Code Generator

A professional desktop application built with Electron for generating and managing unique GemStone NFT codes with automatic correlative tracking and comprehensive database storage.

## Features

- **Code Generation**: Generate unique NFT codes with proprietary checksum algorithm
- **Multi-Gemstone Support**: Create codes for single or multiple gemstone combinations
- **Automatic Correlatives**: Automatic sequential numbering per gemstone/month combination
- **Global Locations**: Comprehensive database of worldwide mining locations
- **QR Code Generation**: Generate QR codes for each unique NFT code
- **Database Storage**: SQLite database for reliable local storage and tracking
- **Statistics & Analytics**: Real-time statistics and generation tracking
- **Export Functionality**: Export codes to CSV format
- **Code Verification**: Verify code integrity and authenticity
- **Search & Filter**: Advanced search and filtering capabilities

## Code Format

Generated codes follow the format: `GM-2509-CAL-001-X7K9`

- **GM**: GemStone identifier
- **2509**: Year (25) and Month (09) 
- **CAL**: Gemstone code (or MIX for multiple)
- **001**: Sequential piece number
- **X7K9**: Proprietary checksum

## Supported Gemstones

- **AME** - Amethyst
- **CAL** - Calcite  
- **QUA** - Quartz
- **CIT** - Citrine
- **ROS** - Rose Quartz
- **SMO** - Smoky Quartz
- **FLU** - Fluorite
- **PYR** - Pyrite
- **OBS** - Obsidian
- **TOU** - Tourmaline
- **DIA** - Diamond
- **RUB** - Ruby
- **EME** - Emerald
- **SAP** - Sapphire
- **TOP** - Topaz
- **AGAT** - Agate
- **JAS** - Jasper
- **MAL** - Malachite
- **TUR** - Turquoise
- **LAP** - Lapis Lazuli

## Installation & Setup

1. **Clone or download the project**
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the application:**
   ```bash
   npm start
   ```

## Development

- **Development mode with DevTools:**
  ```bash
  npm run dev
  ```

## Building for Distribution

- **Build for current platform:**
  ```bash
  npm run build
  ```

- **Build for specific platforms:**
  ```bash
  npm run build-win    # Windows
  npm run build-mac    # macOS
  npm run build-linux  # Linux
  ```

## Project Structure

```
├── index.js                 # Main Electron process
├── src/
│   ├── renderer/
│   │   ├── index.html      # Main UI
│   │   ├── styles.css      # Styling
│   │   └── renderer.js     # Frontend logic
│   └── database/
│       └── database.js     # SQLite database management
├── assets/                 # Icons and images
└── package.json           # Dependencies and scripts
```

## Technologies Used

- **Electron**: Desktop app framework
- **SQLite (better-sqlite3)**: Local database
- **Chart.js**: Data visualization
- **QRCode**: QR code generation
- **HTML5/CSS3**: Modern UI with gradients and animations

## Database Structure

The application uses SQLite with three main tables:

### `gemstones` Table
- Stores available gemstone types with 3-letter codes
- Tracks correlative numbers for each gemstone
- Pre-populated with 20+ gemstone types

### `locations` Table  
- Comprehensive database of worldwide mining locations
- Includes province/state, country, and region information
- Pre-populated with 40+ locations across all continents

### `generated_codes` Table
- Stores all generated NFT codes with full metadata
- Links to gemstones and locations
- Tracks generation date, piece numbers, and checksums

## Database Location

The database file is automatically created in your system's application data directory:

- **Windows**: `%APPDATA%/GemStoneNFTManager/gemstone_codes.db`
- **macOS**: `~/Library/Preferences/GemStoneNFTManager/gemstone_codes.db`
- **Linux**: `~/.local/share/GemStoneNFTManager/gemstone_codes.db`

## Features Overview

### Code Generation Interface
- Multi-select gemstone picker with visual grid
- Location dropdown with searchable options
- Month/Year selectors with auto-default to current date
- Real-time preview of next correlative number
- Optional notes field for additional information

### Code Management
- View all generated codes with full details
- Search codes by content or notes
- Filter by location or gemstone type
- Copy codes to clipboard
- Generate QR codes for individual codes
- Verify code integrity and authenticity

### Statistics & Analytics
- Total codes generated
- Codes generated this month
- Most used gemstones chart
- Location distribution statistics
- Interactive charts and graphs

### Export & Backup
- Export all codes to CSV format
- QR code generation for verification
- Database integrity validation

## Contributing

Feel free to contribute to this project by:
- Reporting bugs
- Suggesting new features
- Submitting pull requests
- Improving documentation

## License

ISC License - Feel free to use and modify as needed.

## Code Generation Algorithm

The application uses a proprietary checksum algorithm to ensure code uniqueness and integrity:

1. **Base Calculation**: Sum of ASCII values of gemstone codes
2. **Date Value**: Month × Year + Piece Number
3. **Hash Generation**: (Base × 17 + Date Value × 23) % 9999
4. **Character Mapping**: Convert to 4-character string using custom character set

This ensures that each generated code is unique and verifiable.

## Example Usage

1. **Select Gemstones**: Choose one or more gemstones from the grid
2. **Choose Location**: Select from the comprehensive location database
3. **Set Date**: Month and year (defaults to current date)
4. **Add Notes**: Optional additional information
5. **Generate**: Create unique code with automatic correlative numbering
6. **Verify**: Use built-in verification to confirm code integrity

## Security Features

- **Unique Codes**: Proprietary algorithm prevents code duplication
- **Checksum Validation**: Built-in verification system
- **Database Integrity**: Automatic validation and error checking
- **Local Storage**: All data stored locally for privacy and security

---

**Generate unique GemStone NFT codes with confidence! 💎**
