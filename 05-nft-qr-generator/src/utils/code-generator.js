class CodeGenerator {
    constructor() {
        this.chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        
        // Common gemstone abbreviations
        this.gemstoneCodes = {
            'AMETHYST': 'AME',
            'QUARTZ': 'QUA',
            'RUBY': 'RUB',
            'SAPPHIRE': 'SAP',
            'EMERALD': 'EME',
            'DIAMOND': 'DIA',
            'TOPAZ': 'TOP',
            'GARNET': 'GAR',
            'PERIDOT': 'PER',
            'TOURMALINE': 'TOU',
            'SPINEL': 'SPI',
            'ZIRCON': 'ZIR',
            'OPAL': 'OPA',
            'TURQUOISE': 'TUR',
            'MALACHITE': 'MAL',
            'AZURITE': 'AZU',
            'FLUORITE': 'FLU',
            'CALCITE': 'CAL',
            'PYRITE': 'PYR',
            'OBSIDIAN': 'OBS',
            'JADE': 'JAD',
            'JADEITE': 'JAD',
            'NEPHRITE': 'NEP',
            'LAPIS': 'LAP',
            'LAPIS LAZULI': 'LAP',
            'SODALITE': 'SOD',
            'MOONSTONE': 'MOO',
            'SUNSTONE': 'SUN',
            'LABRADORITE': 'LAB',
            'AMAZONITE': 'AMA',
            'CITRINE': 'CIT',
            'ROSE QUARTZ': 'ROS',
            'SMOKY QUARTZ': 'SMO',
            'MILKY QUARTZ': 'MIL',
            'TIGER EYE': 'TIG',
            'HAWK EYE': 'HAW',
            'CAT EYE': 'CAT',
            'AVENTURINE': 'AVE',
            'CHRYSOPRASE': 'CHR',
            'AGATE': 'AGA',
            'ONYX': 'ONX',
            'CARNELIAN': 'CAR',
            'JASPER': 'JAS',
            'BLOODSTONE': 'BLO',
            'MOSS AGATE': 'MOS',
            'TREE AGATE': 'TRE',
            'FIRE AGATE': 'FIR',
            'BLUE LACE AGATE': 'BLU',
            'BOTSWANA AGATE': 'BOT',
            'CRAZY LACE AGATE': 'CRA',
            'DENDRITIC AGATE': 'DEN',
            'FORTIFICATION AGATE': 'FOR',
            'LACE AGATE': 'LAC',
            'PLUME AGATE': 'PLU',
            'SNAKESKIN AGATE': 'SNA',
            'THUNDER EGG': 'THU',
            'AQUAMARINE': 'AQU',
            'MORGANITE': 'MOR',
            'HELIODOR': 'HEL',
            'GOSHENITE': 'GOS',
            'RED BERYL': 'RED',
            'MAXIXE': 'MAX',
            'ALMANDINE': 'ALM',
            'PYROPE': 'PYR',
            'SPESSARTINE': 'SPE',
            'GROSSULAR': 'GRO',
            'ANDRADITE': 'AND',
            'UVAROVITE': 'UVA',
            'RHODOLITE': 'RHO',
            'MALAYA': 'MAL',
            'TSAVORITE': 'TSA',
            'DEMANTOID': 'DEM',
            'MELANITE': 'MEL',
            'TOPAZOLITE': 'TOZ',
            'SCHORL': 'SCH',
            'ELBAITE': 'ELB',
            'DRAVITE': 'DRA',
            'UVITE': 'UVI',
            'LIDDICOATITE': 'LID',
            'RUBELLITE': 'RUB',
            'INDICOLITE': 'IND',
            'VERDELITE': 'VER',
            'ACHROITE': 'ACH',
            'WATERMELON': 'WAT',
            'PARAIBA': 'PAR',
            'CHROME TOURMALINE': 'CHR',
            'IMPERIAL TOPAZ': 'IMP',
            'SHERRY TOPAZ': 'SHE',
            'LONDON BLUE': 'LON',
            'SWISS BLUE': 'SWI',
            'SKY BLUE': 'SKY',
            'MISTY TOPAZ': 'MIS',
            'BALAS RUBY': 'BAL',
            'RUBICELLE': 'RUB',
            'GAHNITE': 'GAH',
            'HERCYNITE': 'HER',
            'GALAXITE': 'GAL',
            'HYACINTH': 'HYA',
            'JARGOON': 'JAR',
            'STARLITE': 'STA',
            'CHRYSOLITE': 'CHR',
            'OLIVINE': 'OLI',
            'FORSTERITE': 'FOR',
            'FAYALITE': 'FAY',
            'PRECIOUS OPAL': 'PRE',
            'COMMON OPAL': 'COM',
            'FIRE OPAL': 'FIR',
            'BOULDER OPAL': 'BOU',
            'CRYSTAL OPAL': 'CRY',
            'MILK OPAL': 'MIL',
            'HONEY OPAL': 'HON',
            'PINEAPPLE OPAL': 'PIN',
            'WOOD OPAL': 'WOO',
            'HYDROPHANE': 'HYD',
            'BLACK OPAL': 'BLA',
            'WHITE OPAL': 'WHI',
            'GRAY OPAL': 'GRA',
            'WELO OPAL': 'WEL',
            'ETHIOPIAN OPAL': 'ETH',
            'MEXICAN OPAL': 'MEX',
            'AUSTRALIAN OPAL': 'AUS',
            'BRAZILIAN OPAL': 'BRA',
            'PERUVIAN OPAL': 'PER',
            'CHALCOSIDERITE': 'CHA',
            'FAUSTITE': 'FAU',
            'PLANERITE': 'PLA',
            'CHRYSOCOLLA': 'CHR',
            'DIOPTASE': 'DIO',
            'ATACAMITE': 'ATA',
            'BROCHANTITE': 'BRO',
            'ANTLERITE': 'ANT',
            'CONNELLITE': 'CON',
            'CUPRITE': 'CUP',
            'TENORITE': 'TEN',
            'PARATACAMITE': 'PAR',
            'LAZURITE': 'LAZ',
            'HAUYNE': 'HAU',
            'NOSEAN': 'NOS',
            'CANCINITE': 'CAN',
            'AFGHANITE': 'AFG',
            'ANTOZONITE': 'ANT',
            'CHLOROPHANE': 'CHL',
            'BLUE JOHN': 'BLU',
            'RAINBOW FLUORITE': 'RAI',
            'GREEN FLUORITE': 'GRE',
            'PURPLE FLUORITE': 'PUR',
            'YELLOW FLUORITE': 'YEL',
            'CLEAR FLUORITE': 'CLE',
            'PINK FLUORITE': 'PIN',
            'ORANGE FLUORITE': 'ORA',
            'RED FLUORITE': 'RED',
            'BROWN FLUORITE': 'BRO',
            'BLACK FLUORITE': 'BLA',
            'WHITE FLUORITE': 'WHI',
            'GRAY FLUORITE': 'GRA',
            'ARAGONITE': 'ARA',
            'VATERITE': 'VAT',
            'MAGNESITE': 'MAG',
            'SIDERITE': 'SID',
            'RHODOCHROSITE': 'RHO',
            'SMITHSONITE': 'SMI',
            'OTAVITE': 'OTA',
            'CERUSSITE': 'CER',
            'STRONTIANITE': 'STR',
            'WITHERITE': 'WIT',
            'HUNTITE': 'HUN',
            'DOLOMITE': 'DOL',
            'ANKERITE': 'ANK',
            'KUTNOHORITE': 'KUT',
            'MINRECORDITE': 'MIN',
            'NORSETHITE': 'NOR',
            'BENSTONITE': 'BEN',
            'EITELITE': 'EIT',
            'FAIRCHILDITE': 'FAI',
            'BURBANKITE': 'BUR',
            'CARBOCERNAITE': 'CAR',
            'CLEVITE': 'CLE',
            'DAWSONITE': 'DAW',
            'GAYLUSSITE': 'GAY',
            'PIRSSONITE': 'PIR',
            'SHORTITE': 'SHO',
            'TROGTALITE': 'TRO',
            'ZEMKORITE': 'ZEM',
            'MARCASITE': 'MAR',
            'CHALCOPYRITE': 'CHA',
            'BORNITE': 'BOR',
            'COVELLITE': 'COV',
            'GALENA': 'GAL',
            'SPHALERITE': 'SPH',
            'CINNABAR': 'CIN',
            'REALGAR': 'REA',
            'ORPIMENT': 'ORP',
            'STIBNITE': 'STI',
            'MOLYBDENITE': 'MOL',
            'TUNGSTENITE': 'TUN',
            'MOLYBDITE': 'MOL',
            'WULFENITE': 'WUL',
            'SCHEELITE': 'SCH',
            'POWELLITE': 'POW',
            'FERBERITE': 'FER',
            'HUEBNERITE': 'HUE',
            'WOLFRAMITE': 'WOL',
            'SNOWFLAKE OBSIDIAN': 'SNO',
            'GOLD SHEEN OBSIDIAN': 'GOL',
            'SILVER SHEEN OBSIDIAN': 'SIL',
            'RAINBOW OBSIDIAN': 'RAI',
            'MAHOGANY OBSIDIAN': 'MAH',
            'APACHE TEARS': 'APA',
            'PELE\'S HAIR': 'PEL',
            'PELE\'S TEARS': 'PEL',
            'JADEITE': 'JAD',
            'NEPHRITE': 'NEP',
            'CHLOROMELANITE': 'CHL',
            'MASSIVE JADEITE': 'MAS',
            'IMPERIAL JADE': 'IMP',
            'KINGFISHER JADE': 'KIN',
            'MOSS-IN-SNOW JADE': 'MOS',
            'SPINACH JADE': 'SPI',
            'APPLE JADE': 'APP',
            'LAVENDER JADE': 'LAV',
            'BLUE JADE': 'BLU',
            'PURPLE JADE': 'PUR',
            'RED JADE': 'RED',
            'YELLOW JADE': 'YEL',
            'ORANGE JADE': 'ORA',
            'BROWN JADE': 'BRO',
            'BLACK JADE': 'BLA',
            'WHITE JADE': 'WHI',
            'GRAY JADE': 'GRA',
            'GREEN JADE': 'GRE',
            'KUNZITE': 'KUN',
            'HIDDENITE': 'HID',
            'TANZANITE': 'TAN',
            'IOLITE': 'IOL',
            'CORDIERITE': 'COR',
            'DICHROITE': 'DIC',
            'WATER SAPPHIRE': 'WAT',
            'STEINHEILITE': 'STE',
            'STAR SAPPHIRE': 'STA',
            'STAR RUBY': 'STA',
            'CAT\'S EYE': 'CAT',
            'ALEXANDRITE': 'ALE',
            'CHRYSOBERYL': 'CHR',
            'CYMOPHANE': 'CYM',
            'VARIETY CHRYSOBERYL': 'VAR',
            'PHENAKITE': 'PHE',
            'EUCLASE': 'EUC',
            'DANBURITE': 'DAN',
            'KORNERUPINE': 'KOR',
            'SINHALITE': 'SIN',
            'JEREMEJEVITE': 'JER',
            'GRANDIDIERITE': 'GRA',
            'SERENDIBITE': 'SER',
            'PAINITE': 'PAI',
            'MUSGRAVITE': 'MUS',
            'TAAFFEITE': 'TAA',
            'PEZZOTTAITE': 'PEZ',
            'MAXIXE BERYL': 'MAX',
            'GOSHENITE': 'GOS',
            'HELIODOR': 'HEL',
            'MORGANITE': 'MOR',
            'AQUAMARINE': 'AQU',
            'EMERALD': 'EME',
            'SAPPHIRE': 'SAP',
            'RUBY': 'RUB',
            'DIAMOND': 'DIA'
        };
    }

    getGemstoneCode(name) {
        const upperName = name.toUpperCase();
        
        // Check for exact match first
        if (this.gemstoneCodes[upperName]) {
            return this.gemstoneCodes[upperName];
        }
        
        // Check for partial matches
        for (const [key, code] of Object.entries(this.gemstoneCodes)) {
            if (upperName.includes(key) || key.includes(upperName)) {
                return code;
            }
        }
        
        // If no match found, create a 3-letter code from the name
        const cleanName = upperName.replace(/[^A-Z]/g, '');
        if (cleanName.length >= 3) {
            return cleanName.substring(0, 3);
        } else {
            return cleanName.padEnd(3, 'X');
        }
    }

    generateChecksum(gemstoneNamesStr, month, year, sequence) {
        let base = 0;
        for (const c of gemstoneNamesStr.split('')) {
            base += c.charCodeAt(0);
        }
        const dateVal = month * year + sequence;
        const hash = (base * 17 + dateVal * 23) % 9999;

        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let result = "";
        let temp = hash;

        for (let i = 0; i < 4; i++) {
            result = chars.charAt(temp % chars.length) + result;
            temp = Math.floor(temp / chars.length);
        }
        return result;
    }

    generateCode(gemstoneNames, month, year, pieceNumber) {
        const monthYear = `${year.toString().slice(-2)}${month.toString().padStart(2, '0')}`;

        let gemstonePart;
        if (gemstoneNames.length === 1) {
            const name = gemstoneNames[0].toUpperCase();
            gemstonePart = this.getGemstoneCode(name);
        } else {
            gemstonePart = 'MIX';
        }

        const pieceStr = pieceNumber.toString().padStart(3, '0');
        const checksum = this.generateChecksum(gemstoneNames.join(','), month, year, pieceNumber);

        return `GM-${monthYear}-${gemstonePart}-${pieceStr}-${checksum}`;
    }

    parseCode(fullCode) {
        const parts = fullCode.split('-');
        if (parts.length !== 5 || parts[0] !== 'GM') {
            return null;
        }

        const monthYear = parts[1];
        const gemstonePart = parts[2];
        const pieceNumber = parseInt(parts[3]);
        const checksum = parts[4];

        const year = 2000 + parseInt(monthYear.substring(0, 2));
        const month = parseInt(monthYear.substring(2, 4));

        return {
            year,
            month,
            gemstonePart,
            pieceNumber,
            checksum
        };
    }

    verifyCode(fullCode, gemstoneNames, month, year, pieceNumber) {
        const parsed = this.parseCode(fullCode);
        if (!parsed) {
            return false;
        }

        const expectedChecksum = this.generateChecksum(gemstoneNames.join(','), month, year, pieceNumber);
        return parsed.checksum === expectedChecksum;
    }
}

module.exports = CodeGenerator;