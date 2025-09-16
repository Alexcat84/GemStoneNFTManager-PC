const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class GemStoneCodeDatabase {
    constructor() {
        // Create database file in user data directory
        const dbPath = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share'), 'GemStoneNFTManager', 'gemstone_codes.db');
        
        // Ensure directory exists
        const fs = require('fs');
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath);
        this.initializeTables();
    }

    initializeTables() {
        // First create tables
        const tableQueries = [
            `CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                country VARCHAR(50) NOT NULL,
                region VARCHAR(100) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS generated_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_code VARCHAR(50) UNIQUE NOT NULL,
                gemstone_names TEXT NOT NULL,
                gemstone_codes TEXT NOT NULL,
                location_id INTEGER NOT NULL,
                piece_number INTEGER NOT NULL,
                generation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                checksum VARCHAR(10) NOT NULL,
                notes TEXT,
                FOREIGN KEY (location_id) REFERENCES locations(id)
            )`
        ];

        let tablesCompleted = 0;
        tableQueries.forEach(query => {
            this.db.run(query, (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                }
                tablesCompleted++;
                if (tablesCompleted === tableQueries.length) {
                    this.createIndexes();
                }
            });
        });
    }

    createIndexes() {
        // Then create indexes
        const indexQueries = [
            `CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country)`,
            `CREATE INDEX IF NOT EXISTS idx_generated_codes_full_code ON generated_codes(full_code)`,
            `CREATE INDEX IF NOT EXISTS idx_generated_codes_date ON generated_codes(year, month)`,
            `CREATE INDEX IF NOT EXISTS idx_generated_codes_location ON generated_codes(location_id)`
        ];

        let indexesCompleted = 0;
        indexQueries.forEach(query => {
            this.db.run(query, (err) => {
                if (err) {
                    console.error('Error creating index:', err);
                }
                indexesCompleted++;
                if (indexesCompleted === indexQueries.length) {
                    this.insertInitialData();
                }
            });
        });
    }

    insertInitialData() {
        // Check if locations exist
        this.db.get('SELECT COUNT(*) as count FROM locations', (err, row) => {
            if (err) {
                console.error('Error checking locations:', err);
                return;
            }
            
            if (row.count === 0) {
                const defaultLocations = [
                    // Canada
                    ['Canada', 'Ontario'],
                    ['Canada', 'Quebec'],
                    ['Canada', 'British Columbia'],
                    ['Canada', 'Alberta'],
                    ['Canada', 'Manitoba'],
                    ['Canada', 'Saskatchewan'],
                    ['Canada', 'Nova Scotia'],
                    ['Canada', 'New Brunswick'],
                    ['Canada', 'Newfoundland and Labrador'],
                    ['Canada', 'Yukon'],
                    ['Canada', 'Northwest Territories'],
                    ['Canada', 'Nunavut'],
                    ['Canada', 'Prince Edward Island'],
                    
                    // United States
                    ['United States', 'California'],
                    ['United States', 'Nevada'],
                    ['United States', 'Arizona'],
                    ['United States', 'New Mexico'],
                    ['United States', 'Texas'],
                    ['United States', 'Colorado'],
                    ['United States', 'Utah'],
                    ['United States', 'Montana'],
                    ['United States', 'Wyoming'],
                    ['United States', 'Idaho'],
                    ['United States', 'Oregon'],
                    ['United States', 'Washington'],
                    ['United States', 'Alaska'],
                    ['United States', 'Hawaii'],
                    ['United States', 'Florida'],
                    ['United States', 'Georgia'],
                    ['United States', 'North Carolina'],
                    ['United States', 'South Carolina'],
                    ['United States', 'Tennessee'],
                    ['United States', 'Kentucky'],
                    ['United States', 'Virginia'],
                    ['United States', 'West Virginia'],
                    ['United States', 'Pennsylvania'],
                    ['United States', 'New York'],
                    ['United States', 'New Jersey'],
                    ['United States', 'Connecticut'],
                    ['United States', 'Massachusetts'],
                    ['United States', 'Vermont'],
                    ['United States', 'New Hampshire'],
                    ['United States', 'Maine'],
                    ['United States', 'Ohio'],
                    ['United States', 'Michigan'],
                    ['United States', 'Wisconsin'],
                    ['United States', 'Illinois'],
                    ['United States', 'Indiana'],
                    ['United States', 'Minnesota'],
                    ['United States', 'Iowa'],
                    ['United States', 'Missouri'],
                    ['United States', 'Kansas'],
                    ['United States', 'Nebraska'],
                    ['United States', 'North Dakota'],
                    ['United States', 'South Dakota'],
                    ['United States', 'Oklahoma'],
                    ['United States', 'Arkansas'],
                    ['United States', 'Louisiana'],
                    ['United States', 'Mississippi'],
                    ['United States', 'Alabama'],
                    ['United States', 'Delaware'],
                    ['United States', 'Maryland'],
                    ['United States', 'Rhode Island'],
                    
                    // Mexico
                    ['Mexico', 'Chiapas'],
                    ['Mexico', 'Yucatan'],
                    ['Mexico', 'Oaxaca'],
                    ['Mexico', 'Guerrero'],
                    ['Mexico', 'Michoacan'],
                    ['Mexico', 'Jalisco'],
                    ['Mexico', 'Sonora'],
                    ['Mexico', 'Chihuahua'],
                    ['Mexico', 'Coahuila'],
                    ['Mexico', 'Nuevo Leon'],
                    ['Mexico', 'Tamaulipas'],
                    ['Mexico', 'Veracruz'],
                    ['Mexico', 'Tabasco'],
                    ['Mexico', 'Campeche'],
                    ['Mexico', 'Quintana Roo'],
                    ['Mexico', 'Mexico City'],
                    ['Mexico', 'Baja California'],
                    ['Mexico', 'Baja California Sur'],
                    
                    // Central America
                    ['Guatemala', 'Guatemala'],
                    ['Belize', 'Belize'],
                    ['Honduras', 'Honduras'],
                    ['El Salvador', 'El Salvador'],
                    ['Nicaragua', 'Nicaragua'],
                    ['Costa Rica', 'Costa Rica'],
                    ['Panama', 'Panama'],
                    
                    // South America
                    ['Brazil', 'Minas Gerais'],
                    ['Brazil', 'Bahia'],
                    ['Brazil', 'Goias'],
                    ['Brazil', 'Mato Grosso'],
                    ['Brazil', 'Para'],
                    ['Brazil', 'Amazonas'],
                    ['Brazil', 'Rio Grande do Sul'],
                    ['Brazil', 'Santa Catarina'],
                    ['Brazil', 'Parana'],
                    ['Brazil', 'Sao Paulo'],
                    ['Brazil', 'Rio de Janeiro'],
                    ['Brazil', 'Espirito Santo'],
                    ['Colombia', 'Colombia'],
                    ['Venezuela', 'Venezuela'],
                    ['Guyana', 'Guyana'],
                    ['Suriname', 'Suriname'],
                    ['French Guiana', 'French Guiana'],
                    ['Ecuador', 'Ecuador'],
                    ['Peru', 'Peru'],
                    ['Bolivia', 'Bolivia'],
                    ['Chile', 'Chile'],
                    ['Argentina', 'Argentina'],
                    ['Uruguay', 'Uruguay'],
                    ['Paraguay', 'Paraguay'],
                    
                    // Europe
                    ['Germany', 'Bavaria'],
                    ['Germany', 'Baden-Wurttemberg'],
                    ['Germany', 'Saxony'],
                    ['Germany', 'North Rhine-Westphalia'],
                    ['Germany', 'Lower Saxony'],
                    ['Germany', 'Hesse'],
                    ['Germany', 'Rhineland-Palatinate'],
                    ['Germany', 'Berlin'],
                    ['Germany', 'Hamburg'],
                    ['United Kingdom', 'England'],
                    ['United Kingdom', 'Scotland'],
                    ['United Kingdom', 'Wales'],
                    ['United Kingdom', 'Northern Ireland'],
                    ['Ireland', 'Ireland'],
                    ['France', 'France'],
                    ['Spain', 'Spain'],
                    ['Portugal', 'Portugal'],
                    ['Italy', 'Italy'],
                    ['Switzerland', 'Switzerland'],
                    ['Austria', 'Austria'],
                    ['Netherlands', 'Netherlands'],
                    ['Belgium', 'Belgium'],
                    ['Luxembourg', 'Luxembourg'],
                    ['Monaco', 'Monaco'],
                    ['Andorra', 'Andorra'],
                    ['San Marino', 'San Marino'],
                    ['Vatican City', 'Vatican City'],
                    ['Liechtenstein', 'Liechtenstein'],
                    
                    // Eastern Europe
                    ['Poland', 'Poland'],
                    ['Czech Republic', 'Czech Republic'],
                    ['Slovakia', 'Slovakia'],
                    ['Hungary', 'Hungary'],
                    ['Slovenia', 'Slovenia'],
                    ['Croatia', 'Croatia'],
                    ['Bosnia and Herzegovina', 'Bosnia and Herzegovina'],
                    ['Serbia', 'Serbia'],
                    ['Montenegro', 'Montenegro'],
                    ['North Macedonia', 'North Macedonia'],
                    ['Albania', 'Albania'],
                    ['Kosovo', 'Kosovo'],
                    ['Bulgaria', 'Bulgaria'],
                    ['Romania', 'Romania'],
                    ['Moldova', 'Moldova'],
                    ['Ukraine', 'Ukraine'],
                    ['Belarus', 'Belarus'],
                    ['Lithuania', 'Lithuania'],
                    ['Latvia', 'Latvia'],
                    ['Estonia', 'Estonia'],
                    ['Russia', 'Russia'],
                    ['Finland', 'Finland'],
                    ['Sweden', 'Sweden'],
                    ['Norway', 'Norway'],
                    ['Denmark', 'Denmark'],
                    ['Iceland', 'Iceland'],
                    ['Greenland', 'Greenland'],
                    ['Faroe Islands', 'Faroe Islands'],
                    
                    // Asia
                    ['India', 'Madhya Pradesh'],
                    ['India', 'Rajasthan'],
                    ['India', 'Gujarat'],
                    ['India', 'Maharashtra'],
                    ['India', 'Karnataka'],
                    ['India', 'Tamil Nadu'],
                    ['India', 'Kerala'],
                    ['India', 'Andhra Pradesh'],
                    ['India', 'Telangana'],
                    ['India', 'Odisha'],
                    ['India', 'West Bengal'],
                    ['India', 'Bihar'],
                    ['India', 'Jharkhand'],
                    ['India', 'Chhattisgarh'],
                    ['India', 'Uttar Pradesh'],
                    ['India', 'Uttarakhand'],
                    ['India', 'Himachal Pradesh'],
                    ['India', 'Jammu and Kashmir'],
                    ['India', 'Punjab'],
                    ['India', 'Haryana'],
                    ['India', 'Delhi'],
                    ['India', 'Assam'],
                    ['India', 'Arunachal Pradesh'],
                    ['India', 'Manipur'],
                    ['India', 'Meghalaya'],
                    ['India', 'Mizoram'],
                    ['India', 'Nagaland'],
                    ['India', 'Tripura'],
                    ['India', 'Sikkim'],
                    ['India', 'Goa'],
                    ['India', 'Puducherry'],
                    ['India', 'Lakshadweep'],
                    ['India', 'Andaman and Nicobar'],
                    ['Pakistan', 'Pakistan'],
                    ['Bangladesh', 'Bangladesh'],
                    ['Sri Lanka', 'Sri Lanka'],
                    ['Maldives', 'Maldives'],
                    ['Nepal', 'Nepal'],
                    ['Bhutan', 'Bhutan'],
                    ['Afghanistan', 'Afghanistan'],
                    
                    // Southeast Asia
                    ['Myanmar', 'Myanmar'],
                    ['Thailand', 'Thailand'],
                    ['Laos', 'Laos'],
                    ['Cambodia', 'Cambodia'],
                    ['Vietnam', 'Vietnam'],
                    ['Malaysia', 'Malaysia'],
                    ['Singapore', 'Singapore'],
                    ['Brunei', 'Brunei'],
                    ['Indonesia', 'Indonesia'],
                    ['Philippines', 'Philippines'],
                    ['East Timor', 'East Timor'],
                    
                    // East Asia
                    ['China', 'China'],
                    ['Japan', 'Japan'],
                    ['South Korea', 'South Korea'],
                    ['North Korea', 'North Korea'],
                    ['Mongolia', 'Mongolia'],
                    ['Taiwan', 'Taiwan'],
                    ['Hong Kong', 'Hong Kong'],
                    ['Macau', 'Macau'],
                    
                    // Central Asia
                    ['Kazakhstan', 'Kazakhstan'],
                    ['Uzbekistan', 'Uzbekistan'],
                    ['Turkmenistan', 'Turkmenistan'],
                    ['Tajikistan', 'Tajikistan'],
                    ['Kyrgyzstan', 'Kyrgyzstan'],
                    
                    // Western Asia
                    ['Turkey', 'Turkey'],
                    ['Georgia', 'Georgia'],
                    ['Armenia', 'Armenia'],
                    ['Azerbaijan', 'Azerbaijan'],
                    ['Iran', 'Iran'],
                    ['Iraq', 'Iraq'],
                    ['Syria', 'Syria'],
                    ['Lebanon', 'Lebanon'],
                    ['Jordan', 'Jordan'],
                    ['Israel', 'Israel'],
                    ['Palestine', 'Palestine'],
                    ['Saudi Arabia', 'Saudi Arabia'],
                    ['Yemen', 'Yemen'],
                    ['Oman', 'Oman'],
                    ['United Arab Emirates', 'United Arab Emirates'],
                    ['Qatar', 'Qatar'],
                    ['Bahrain', 'Bahrain'],
                    ['Kuwait', 'Kuwait'],
                    ['Cyprus', 'Cyprus'],
                    
                    // Africa
                    ['Morocco', 'Morocco'],
                    ['Algeria', 'Algeria'],
                    ['Tunisia', 'Tunisia'],
                    ['Libya', 'Libya'],
                    ['Egypt', 'Egypt'],
                    ['Sudan', 'Sudan'],
                    ['South Sudan', 'South Sudan'],
                    ['Ethiopia', 'Ethiopia'],
                    ['Eritrea', 'Eritrea'],
                    ['Djibouti', 'Djibouti'],
                    ['Somalia', 'Somalia'],
                    ['Somaliland', 'Somaliland'],
                    ['Mauritania', 'Mauritania'],
                    ['Mali', 'Mali'],
                    ['Burkina Faso', 'Burkina Faso'],
                    ['Niger', 'Niger'],
                    ['Chad', 'Chad'],
                    ['Senegal', 'Senegal'],
                    ['Gambia', 'Gambia'],
                    ['Guinea-Bissau', 'Guinea-Bissau'],
                    ['Guinea', 'Guinea'],
                    ['Sierra Leone', 'Sierra Leone'],
                    ['Liberia', 'Liberia'],
                    ['Ivory Coast', 'Ivory Coast'],
                    ['Ghana', 'Ghana'],
                    ['Togo', 'Togo'],
                    ['Benin', 'Benin'],
                    ['Nigeria', 'Nigeria'],
                    ['Cameroon', 'Cameroon'],
                    ['Central African Republic', 'Central African Republic'],
                    ['Equatorial Guinea', 'Equatorial Guinea'],
                    ['Gabon', 'Gabon'],
                    ['Republic of the Congo', 'Republic of the Congo'],
                    ['Democratic Republic of the Congo', 'Democratic Republic of the Congo'],
                    ['Angola', 'Angola'],
                    ['Zambia', 'Zambia'],
                    ['Zimbabwe', 'Zimbabwe'],
                    ['Botswana', 'Botswana'],
                    ['Namibia', 'Namibia'],
                    ['South Africa', 'South Africa'],
                    ['Lesotho', 'Lesotho'],
                    ['Eswatini', 'Eswatini'],
                    ['Malawi', 'Malawi'],
                    ['Mozambique', 'Mozambique'],
                    ['Madagascar', 'Madagascar'],
                    ['Mauritius', 'Mauritius'],
                    ['Seychelles', 'Seychelles'],
                    ['Comoros', 'Comoros'],
                    ['Mayotte', 'Mayotte'],
                    ['Reunion', 'Reunion'],
                    ['Kenya', 'Kenya'],
                    ['Tanzania', 'Tanzania'],
                    ['Uganda', 'Uganda'],
                    ['Rwanda', 'Rwanda'],
                    ['Burundi', 'Burundi'],
                    
                    // Oceania
                    ['Australia', 'New South Wales'],
                    ['Australia', 'Victoria'],
                    ['Australia', 'Queensland'],
                    ['Australia', 'Western Australia'],
                    ['Australia', 'South Australia'],
                    ['Australia', 'Tasmania'],
                    ['Australia', 'Northern Territory'],
                    ['Australia', 'Australian Capital Territory'],
                    ['New Zealand', 'New Zealand'],
                    ['Papua New Guinea', 'Papua New Guinea'],
                    ['Fiji', 'Fiji'],
                    ['Solomon Islands', 'Solomon Islands'],
                    ['Vanuatu', 'Vanuatu'],
                    ['New Caledonia', 'New Caledonia'],
                    ['Samoa', 'Samoa'],
                    ['American Samoa', 'American Samoa'],
                    ['Tonga', 'Tonga'],
                    ['Tuvalu', 'Tuvalu'],
                    ['Kiribati', 'Kiribati'],
                    ['Nauru', 'Nauru'],
                    ['Palau', 'Palau'],
                    ['Marshall Islands', 'Marshall Islands'],
                    ['Micronesia', 'Micronesia'],
                    ['Guam', 'Guam'],
                    ['Northern Mariana Islands', 'Northern Mariana Islands'],
                    ['Cook Islands', 'Cook Islands'],
                    ['Niue', 'Niue'],
                    ['Tokelau', 'Tokelau'],
                    ['French Polynesia', 'French Polynesia'],
                    ['Wallis and Futuna', 'Wallis and Futuna'],
                    ['Pitcairn Islands', 'Pitcairn Islands'],
                    ['Easter Island', 'Easter Island']
                ];

                const stmt = this.db.prepare('INSERT INTO locations (country, region) VALUES (?, ?)');
                defaultLocations.forEach(([country, region]) => {
                    stmt.run(country, region);
                });
                stmt.finalize();
                console.log('Default locations inserted successfully');
            }
        });
    }

    // Gemstone management methods
    getAllGemstones() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM gemstones ORDER BY name', (err, rows) => {
                if (err) {
                    console.error('Error getting gemstones:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    getGemstoneByCode(code) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM gemstones WHERE code = ?', [code], (err, row) => {
                if (err) {
                    console.error('Error getting gemstone by code:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    addGemstone(code, name) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT INTO gemstones (code, name, correlative) VALUES (?, ?, 0)', [code, name], function(err) {
                if (err) {
                    console.error('Error adding gemstone:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, code, name, correlative: 0 });
                }
            });
        });
    }

    // Location management methods
    getAllLocations() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM locations ORDER BY country, region', (err, rows) => {
                if (err) {
                    console.error('Error getting locations:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    getLocationById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM locations WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('Error getting location by ID:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    addLocation(province, country, region) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT INTO locations (province, country, region) VALUES (?, ?, ?)', [province, country, region], function(err) {
                if (err) {
                    console.error('Error adding location:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, province, country, region });
                }
            });
        });
    }

    // Generated codes management methods
    getAllGeneratedCodes() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT gc.*, l.country, l.region
                FROM generated_codes gc
                JOIN locations l ON gc.location_id = l.id
                ORDER BY gc.generation_date DESC
            `, (err, rows) => {
                if (err) {
                    console.error('Error getting generated codes:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    getGeneratedCodeByFullCode(fullCode) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT gc.*, l.country, l.region
                FROM generated_codes gc
                JOIN locations l ON gc.location_id = l.id
                WHERE gc.full_code = ?
            `, [fullCode], (err, row) => {
                if (err) {
                    console.error('Error getting generated code:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    addGeneratedCode(codeData) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO generated_codes (full_code, gemstone_names, gemstone_codes, location_id, piece_number, month, year, checksum, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                codeData.full_code,
                codeData.gemstone_names,
                codeData.gemstone_codes,
                codeData.location_id,
                codeData.piece_number,
                codeData.month,
                codeData.year,
                codeData.checksum,
                codeData.notes || ''
            ], function(err) {
                if (err) {
                    console.error('Error adding generated code:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...codeData });
                }
            });
        });
    }

    // Correlative management
    getNextCorrelative(gemstoneNames, month, year) {
        return new Promise((resolve, reject) => {
            const gemstoneNamesStr = JSON.stringify(gemstoneNames);
            this.db.get(`
                SELECT MAX(piece_number) as max_number
                FROM generated_codes
                WHERE gemstone_names = ? AND month = ? AND year = ?
            `, [gemstoneNamesStr, month, year], (err, row) => {
                if (err) {
                    console.error('Error getting next correlative:', err);
                    reject(err);
                } else {
                    resolve((row.max_number || 0) + 1);
                }
            });
        });
    }

    // Statistics methods
    getStats() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM generated_codes', (err, totalCodes) => {
                if (err) {
                    console.error('Error getting total codes:', err);
                    reject(err);
                    return;
                }

                const thisMonth = new Date().getMonth() + 1;
                const thisYear = new Date().getFullYear();
                
                this.db.get(`
                    SELECT COUNT(*) as count FROM generated_codes 
                    WHERE month = ? AND year = ?
                `, [thisMonth, thisYear], (err, thisMonthCodes) => {
                    if (err) {
                        console.error('Error getting this month codes:', err);
                        reject(err);
                        return;
                    }

                    this.db.all(`
                        SELECT gemstone_codes, COUNT(*) as count
                        FROM generated_codes
                        GROUP BY gemstone_codes
                        ORDER BY count DESC
                    `, (err, gemstoneStats) => {
                        if (err) {
                            console.error('Error getting gemstone stats:', err);
                            reject(err);
                            return;
                        }

                        this.db.all(`
                            SELECT l.country, l.region, COUNT(gc.id) as count
                            FROM locations l
                            LEFT JOIN generated_codes gc ON gc.location_id = l.id
                            GROUP BY l.id, l.country, l.region
                            ORDER BY count DESC
                        `, (err, locationStats) => {
                            if (err) {
                                console.error('Error getting location stats:', err);
                                reject(err);
                                return;
                            }

                            resolve({
                                totalCodes: totalCodes.count,
                                thisMonthCodes: thisMonthCodes.count,
                                gemstoneStats,
                                locationStats
                            });
                        });
                    });
                });
            });
        });
    }

    // Search methods
    searchGeneratedCodes(query) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT gc.*, l.country, l.province, l.region
                FROM generated_codes gc
                JOIN locations l ON gc.location_id = l.id
                WHERE gc.full_code LIKE ? OR gc.notes LIKE ?
                ORDER BY gc.generation_date DESC
            `, [`%${query}%`, `%${query}%`], (err, rows) => {
                if (err) {
                    console.error('Error searching generated codes:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = GemStoneCodeDatabase;