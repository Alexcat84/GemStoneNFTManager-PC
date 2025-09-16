const { ipcRenderer } = require('electron');

class GemStoneCodeGenerator {
    constructor() {
        this.locations = [];
        this.generatedCodes = [];
        this.chart = null;
        this.previewData = null;
        
        this.initializeEventListeners();
        this.loadInitialData();
    }

    initializeEventListeners() {
        // Form submission
        document.getElementById('codeForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        // Preview button removed - not needed
        
        // Gemstone input change
        document.getElementById('gemstoneInput').addEventListener('input', () => this.updateNextNumber());
        
        // Modal controls
        this.setupModalControls();
        
        // Search and filter
        document.getElementById('searchInput').addEventListener('input', (e) => this.filterCodes());
        document.getElementById('searchBtn').addEventListener('click', (e) => this.filterCodes());
        document.getElementById('locationFilter').addEventListener('change', (e) => this.filterCodes());
        document.getElementById('gemstoneFilter').addEventListener('change', (e) => this.filterCodes());
        
        // Action buttons
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadGeneratedCodes());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportToCSV());
        
        // Preview modal
        document.getElementById('confirmGenerateBtn').addEventListener('click', () => this.confirmGeneration());
        document.getElementById('cancelPreviewBtn').addEventListener('click', () => this.closeModal('previewModal'));
        
        // Add gemstone modal
        document.getElementById('addGemstoneForm').addEventListener('submit', (e) => this.handleAddGemstone(e));
        document.getElementById('cancelAddGemstoneBtn').addEventListener('click', () => this.closeModal('addGemstoneModal'));
        
        // Add location modal
        document.getElementById('addLocationForm').addEventListener('submit', (e) => this.handleAddLocation(e));
        document.getElementById('cancelAddLocationBtn').addEventListener('click', () => this.closeModal('addLocationModal'));
        
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
    }

    setupModalControls() {
        // Close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal.id);
            });
        });
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadLocations(),
                this.loadGeneratedCodes(),
                this.loadStats()
            ]);
            
            this.populateYearSelect();
            this.setCurrentDate();
            this.updateNextNumber();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load application data');
        }
    }

    async loadLocations() {
        try {
            this.locations = await ipcRenderer.invoke('get-locations');
            this.populateLocationSelect();
            this.populateLocationFilter();
        } catch (error) {
            console.error('Error loading locations:', error);
            throw error;
        }
    }

    async loadGeneratedCodes() {
        try {
            this.generatedCodes = await ipcRenderer.invoke('get-generated-codes');
            this.renderGeneratedCodes();
            this.populateGemstoneFilter(); // Update gemstone filter with new codes
        } catch (error) {
            console.error('Error loading generated codes:', error);
            throw error;
        }
    }

    async loadStats() {
        try {
            const stats = await ipcRenderer.invoke('get-stats');
            this.updateStats(stats);
            this.updateChart(stats);
        } catch (error) {
            console.error('Error loading stats:', error);
            throw error;
        }
    }

    // Gemstone functions removed - now using free text input

    populateLocationSelect() {
        const select = document.getElementById('locationSelect');
        select.innerHTML = '<option value="">Select Location...</option>';
        
        this.locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.id;
            option.textContent = `${location.region}, ${location.country}`;
            select.appendChild(option);
        });
    }

    populateLocationFilter() {
        const select = document.getElementById('locationFilter');
        select.innerHTML = '<option value="">All Locations</option>';
        
        this.locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.id;
            option.textContent = `${location.region}, ${location.country}`;
            select.appendChild(option);
        });
    }

    populateGemstoneFilter() {
        const select = document.getElementById('gemstoneFilter');
        select.innerHTML = '<option value="">All Gemstones</option>';
        
        // Get unique gemstone names from generated codes
        const uniqueGemstones = new Set();
        this.generatedCodes.forEach(code => {
            const gemstoneNames = JSON.parse(code.gemstone_names || '[]');
            gemstoneNames.forEach(name => uniqueGemstones.add(name));
        });
        
        // Sort and add to filter
        Array.from(uniqueGemstones).sort().forEach(gemstoneName => {
            const option = document.createElement('option');
            option.value = gemstoneName;
            option.textContent = gemstoneName;
            select.appendChild(option);
        });
    }

    populateYearSelect() {
        const select = document.getElementById('yearSelect');
        const currentYear = new Date().getFullYear();
        
        for (let year = currentYear - 2; year <= currentYear + 5; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            select.appendChild(option);
        }
    }

    setCurrentDate() {
        const now = new Date();
        document.getElementById('monthSelect').value = now.getMonth() + 1;
        document.getElementById('yearSelect').value = now.getFullYear();
    }

    async updateNextNumber() {
        const gemstoneNames = this.getGemstoneNames();
        if (gemstoneNames.length === 0) {
            document.getElementById('nextNumber').textContent = '001';
            return;
        }

        try {
            const month = parseInt(document.getElementById('monthSelect').value);
            const year = parseInt(document.getElementById('yearSelect').value);
            
            const nextNumber = await ipcRenderer.invoke('get-next-correlative', gemstoneNames, month, year);
            document.getElementById('nextNumber').textContent = nextNumber.toString().padStart(3, '0');
        } catch (error) {
            console.error('Error getting next number:', error);
        }
    }

    // Preview function removed - not needed with new system

    populatePreviewModal() {
        const data = this.previewData;
        
        document.getElementById('previewCode').textContent = data.fullCode;
        
        // Get gemstone names
        const gemstoneNames = data.gemstoneCodes.map(code => {
            const gemstone = this.gemstones.find(g => g.code === code);
            return gemstone ? gemstone.name : code;
        });
        document.getElementById('previewGemstones').textContent = gemstoneNames.join(' + ');
        
        // Get location name
        const location = this.locations.find(l => l.id === data.locationId);
        document.getElementById('previewLocation').textContent = location ? 
            `${location.region}, ${location.country}` : 'Unknown Location';
        
        // Format date
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        document.getElementById('previewDate').textContent = `${monthNames[data.month - 1]} ${data.year}`;
        
        document.getElementById('previewPiece').textContent = data.pieceNumber.toString().padStart(3, '0');
        
        // Generate QR code
        this.generateQRCode(data.fullCode);
    }

    generateQRCode(fullCode) {
        const canvas = document.getElementById('qrCanvas');
        const qrData = {
            code: fullCode,
            type: 'GemStone NFT',
            generated: new Date().toISOString()
        };
        
        QRCode.toCanvas(canvas, JSON.stringify(qrData), {
            width: 200,
            margin: 2,
            color: {
                dark: '#2d3748',
                light: '#ffffff'
            }
        }, (error) => {
            if (error) {
                console.error('Error generating QR code:', error);
            }
        });
    }

    async confirmGeneration() {
        try {
            const result = await ipcRenderer.invoke('generate-code', 
                this.previewData.gemstoneCodes,
                this.previewData.locationId,
                this.previewData.month,
                this.previewData.year,
                this.previewData.notes
            );
            
            this.closeModal('previewModal');
            this.showSuccess(`Code generated successfully: ${result.fullCode}`);
            
            // Clear form
            this.clearForm();
            
            // Reload data
            await this.loadGeneratedCodes();
            await this.loadStats();
            
        } catch (error) {
            console.error('Error generating code:', error);
            this.showError('Failed to generate code');
        }
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        
        if (!this.validateForm()) return;
        
        try {
            const formData = this.getFormData();
            const gemstoneNames = this.getGemstoneNames();
            
            const result = await ipcRenderer.invoke('generate-code', 
                gemstoneNames,
                formData.locationId,
                parseInt(formData.month),
                parseInt(formData.year),
                formData.notes
            );
            
            this.showSuccess(`Code generated successfully: ${result.fullCode}`);
            this.clearForm();
            
            // Reload data
            await this.loadGeneratedCodes();
            await this.loadStats();
            
        } catch (error) {
            console.error('Error generating code:', error);
            this.showError('Failed to generate code');
        }
    }

    getGemstoneNames() {
        const gemstoneInput = document.getElementById('gemstoneInput');
        const input = gemstoneInput.value.trim();
        
        if (!input) return [];
        
        // Split by comma and clean up each name
        return input.split(',')
            .map(name => name.trim())
            .filter(name => name.length > 0);
    }

    validateForm() {
        const gemstoneNames = this.getGemstoneNames();
        if (gemstoneNames.length === 0) {
            this.showError('Please enter at least one gemstone name');
            return false;
        }
        
        const locationId = document.getElementById('locationSelect').value;
        if (!locationId) {
            this.showError('Please select a location');
            return false;
        }
        
        return true;
    }

    getFormData() {
        return {
            locationId: document.getElementById('locationSelect').value,
            month: document.getElementById('monthSelect').value,
            year: document.getElementById('yearSelect').value,
            notes: document.getElementById('notesInput').value
        };
    }

    clearForm() {
        // Clear gemstone input
        document.getElementById('gemstoneInput').value = '';
        
        // Clear other fields
        document.getElementById('locationSelect').value = '';
        document.getElementById('notesInput').value = '';
        
        // Reset to current date
        this.setCurrentDate();
        this.updateNextNumber();
    }

    renderGeneratedCodes() {
        const container = document.getElementById('codesList');
        
        if (this.generatedCodes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No codes generated yet</h3>
                    <p>Start by generating your first GemStone NFT code using the form on the left.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.generatedCodes.map(code => this.createCodeItem(code)).join('');
    }

    createCodeItem(code) {
        const gemstoneNames = JSON.parse(code.gemstone_names);
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const date = new Date(code.generation_date);
        const formattedDate = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
        
        return `
            <div class="code-item">
                <div class="code-header">
                    <div class="code-value">${code.full_code}</div>
                    <div class="code-date">${formattedDate}</div>
                </div>
                
                <div class="code-details">
                    <div class="detail-item">
                        <span class="detail-label">Gemstones:</span>
                        <span class="detail-value">${gemstoneNames.join(' + ')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Location:</span>
                        <span class="detail-value">${code.region}, ${code.country}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Piece Number:</span>
                        <span class="detail-value">${code.piece_number.toString().padStart(3, '0')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Checksum:</span>
                        <span class="detail-value">${code.checksum}</span>
                    </div>
                </div>
                
                ${code.notes ? `<div class="code-notes">${code.notes}</div>` : ''}
                
                <div class="code-actions">
                    <button class="btn-small btn-copy" onclick="app.copyCode('${code.full_code}')">📋 Copy</button>
                    <button class="btn-small btn-qr" onclick="app.showQRCode('${code.full_code}')">📱 QR</button>
                    <button class="btn-small btn-verify" onclick="app.verifyCode('${code.full_code}')">✅ Verify</button>
                </div>
            </div>
        `;
    }

    filterCodes() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const locationFilter = document.getElementById('locationFilter').value;
        const gemstoneFilter = document.getElementById('gemstoneFilter').value;
        
        let filteredCodes = this.generatedCodes.filter(code => {
            // Search in full code, gemstone names, location, and notes
            const gemstoneNames = JSON.parse(code.gemstone_names || '[]').join(' ').toLowerCase();
            const locationText = `${code.region || ''} ${code.country || ''}`.toLowerCase();
            const notes = (code.notes || '').toLowerCase();
            
            const matchesSearch = !searchTerm || 
                                code.full_code.toLowerCase().includes(searchTerm) ||
                                gemstoneNames.includes(searchTerm) ||
                                locationText.includes(searchTerm) ||
                                notes.includes(searchTerm);
            
            const matchesLocation = !locationFilter || code.location_id.toString() === locationFilter;
            const matchesGemstone = !gemstoneFilter || gemstoneNames.includes(gemstoneFilter.toLowerCase());
            
            return matchesSearch && matchesLocation && matchesGemstone;
        });
        
        // Temporarily replace the codes list
        const originalCodes = this.generatedCodes;
        this.generatedCodes = filteredCodes;
        this.renderGeneratedCodes();
        this.generatedCodes = originalCodes;
        
        // Show search results count
        if (searchTerm && filteredCodes.length === 0) {
            this.showInfo(`No codes found for "${searchTerm}"`);
        } else if (searchTerm && filteredCodes.length > 0) {
            this.showSuccess(`Found ${filteredCodes.length} code(s) for "${searchTerm}"`);
        }
    }

    updateStats(stats) {
        document.getElementById('totalCodes').textContent = stats.totalCodes;
        document.getElementById('thisMonthCodes').textContent = stats.thisMonthCodes;
    }

    updateChart(stats) {
        const ctx = document.getElementById('statsChart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }

        // Use gemstone_codes from stats instead of gemstoneStats
        const labels = stats.gemstoneStats ? stats.gemstoneStats.map(s => s.gemstone_codes || 'Unknown') : [];
        const data = stats.gemstoneStats ? stats.gemstoneStats.map(s => s.count) : [];

        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe',
                        '#00f2fe', '#43e97b', '#fa709a', '#ffecd2', '#a8edea'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            usePointStyle: true,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }

    async handleAddGemstone(event) {
        event.preventDefault();
        
        const code = document.getElementById('gemstoneCode').value.toUpperCase();
        const name = document.getElementById('gemstoneName').value;
        
        try {
            await ipcRenderer.invoke('add-gemstone', code, name);
            this.showSuccess('Gemstone added successfully');
            this.closeModal('addGemstoneModal');
            document.getElementById('addGemstoneForm').reset();
            await this.loadGemstones();
        } catch (error) {
            console.error('Error adding gemstone:', error);
            this.showError('Failed to add gemstone');
        }
    }

    async handleAddLocation(event) {
        event.preventDefault();
        
        const country = document.getElementById('locationCountry').value;
        const region = document.getElementById('locationRegion').value;
        
        try {
            await ipcRenderer.invoke('add-location', country, region);
            this.showSuccess('Location added successfully');
            this.closeModal('addLocationModal');
            document.getElementById('addLocationForm').reset();
            await this.loadLocations();
        } catch (error) {
            console.error('Error adding location:', error);
            this.showError('Failed to add location');
        }
    }

    copyCode(fullCode) {
        navigator.clipboard.writeText(fullCode).then(() => {
            this.showSuccess('Code copied to clipboard');
        }).catch(() => {
            this.showError('Failed to copy code');
        });
    }

    showQRCode(fullCode) {
        // Create a simple QR code display
        const qrData = {
            code: fullCode,
            type: 'GemStone NFT',
            generated: new Date().toISOString()
        };
        
        const newWindow = window.open('', '_blank', 'width=400,height=400');
        newWindow.document.write(`
            <html>
                <head><title>QR Code - ${fullCode}</title></head>
                <body style="text-align: center; padding: 20px; font-family: Arial, sans-serif;">
                    <h2>${fullCode}</h2>
                    <canvas id="qr" width="300" height="300"></canvas>
                    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
                    <script>
                        QRCode.toCanvas(document.getElementById('qr'), '${JSON.stringify(qrData)}', {
                            width: 300,
                            margin: 2
                        });
                    </script>
                </body>
            </html>
        `);
    }

    async verifyCode(fullCode) {
        try {
            const parsed = await ipcRenderer.invoke('parse-code', fullCode);
            if (parsed) {
                this.showSuccess(`Code is valid: ${parsed.gemstonePart} - Piece ${parsed.pieceNumber}`);
            } else {
                this.showError('Invalid code format');
            }
        } catch (error) {
            console.error('Error verifying code:', error);
            this.showError('Failed to verify code');
        }
    }

    exportToCSV() {
        if (this.generatedCodes.length === 0) {
            this.showError('No codes to export');
            return;
        }
        
        const headers = ['Full Code', 'Gemstones', 'Location', 'Piece Number', 'Month', 'Year', 'Checksum', 'Notes', 'Generated Date'];
        const rows = this.generatedCodes.map(code => {
            const gemstoneCodes = JSON.parse(code.gemstone_ids);
            const gemstoneNames = gemstoneCodes.map(gc => {
                const gemstone = this.gemstones.find(g => g.code === gc);
                return gemstone ? gemstone.name : gc;
            });
            
            return [
                code.full_code,
                gemstoneNames.join(' + '),
                `${code.region}, ${code.country}`,
                code.piece_number,
                code.month,
                code.year,
                code.checksum,
                code.notes || '',
                new Date(code.generation_date).toLocaleDateString()
            ];
        });
        
        const csvContent = [headers, ...rows].map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gemstone-codes-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        this.showSuccess('Codes exported to CSV');
    }

    openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `message ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Simple CodeGenerator class for preview
class CodeGenerator {
    generateCode(gemstoneCodes, month, year, pieceNumber) {
        const monthYear = `${year.toString().slice(-2)}${month.toString().padStart(2, '0')}`;
        const gemstonePart = gemstoneCodes.length === 1 ? gemstoneCodes[0] : 'MIX';
        const pieceStr = pieceNumber.toString().padStart(3, '0');
        const checksum = this.generateChecksum(gemstoneCodes.join(','), month, year, pieceNumber);
        
        return `GM-${monthYear}-${gemstonePart}-${pieceStr}-${checksum}`;
    }
    
    generateChecksum(gemstones, month, year, sequence) {
        let base = 0;
        for (let char of gemstones) {
            base += char.charCodeAt(0);
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
}

// Initialize the application when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GemStoneCodeGenerator();
});

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
