const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');

const ZonesService = require('./zones.service');
const ProfilesService = require('./profiles.service');
const TicketsService = require('./tickets.service');
const ImportService = require('./import.service');
const MonitorService = require('./monitor.service');
const RouterOSService = require('./routeros.service');  // ← CORRIGÉ

const upload = multer({ storage: multer.memoryStorage() });

// =============================================
// ROUTES - ZONES
// =============================================

router.post('/zones', async (req, res) => {
    const result = await ZonesService.createZone(req.body);
    res.json(result);
});

router.get('/zones/:ownerId', async (req, res) => {
    const result = await ZonesService.getZonesByOwner(req.params.ownerId);
    res.json(result);
});

router.get('/zone/:zoneId', async (req, res) => {
    const result = await ZonesService.getZoneById(req.params.zoneId);
    res.json(result);
});

router.put('/zone/:zoneId', async (req, res) => {
    const result = await ZonesService.updateZone(req.params.zoneId, req.body);
    res.json(result);
});

router.delete('/zone/:zoneId', async (req, res) => {
    const result = await ZonesService.deleteZone(req.params.zoneId);
    res.json(result);
});

router.post('/zone/test/:zoneId', async (req, res) => {
    const result = await ZonesService.testZoneConnection(req.params.zoneId);
    res.json(result);
});

// =============================================
// ROUTES - PROFILS
// =============================================

router.post('/profiles', async (req, res) => {
    const result = await ProfilesService.createProfile(req.body);
    res.json(result);
});

router.get('/profiles/:zoneId', async (req, res) => {
    const result = await ProfilesService.getProfilesByZone(req.params.zoneId);
    res.json(result);
});

router.put('/profile/:profileId', async (req, res) => {
    const result = await ProfilesService.updateProfile(req.params.profileId, req.body);
    res.json(result);
});

router.delete('/profile/:profileId', async (req, res) => {
    const result = await ProfilesService.deleteProfile(req.params.profileId);
    res.json(result);
});

// =============================================
// ROUTES - TICKETS
// =============================================

router.post('/tickets', async (req, res) => {
    const result = await TicketsService.createTicket(req.body);
    res.json(result);
});

router.get('/tickets/:zoneId', async (req, res) => {
    const { etat } = req.query;
    const result = await TicketsService.getTicketsByZone(req.params.zoneId, etat);
    res.json(result);
});

router.post('/ticket/sell/:ticketId', async (req, res) => {
    const { clientPhone } = req.body;
    const result = await TicketsService.sellTicket(req.params.ticketId, clientPhone);
    res.json(result);
});

router.delete('/ticket/:ticketId', async (req, res) => {
    const result = await TicketsService.deleteTicket(req.params.ticketId);
    res.json(result);
});

// =============================================
// ROUTES - IMPORT
// =============================================

router.post('/import/pdf', upload.single('file'), async (req, res) => {
    try {
        const { zoneId, profileId } = req.body;
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Aucun fichier' });
        }

        const data = await pdfParse(req.file.buffer);
        const codes = ImportService.extractCodes(data.text);

        if (codes.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun code valide trouvé'
            });
        }

        const result = await ImportService.importFromPDF(zoneId, profileId, codes);
        res.json(result);
    } catch (error) {
        console.error('❌ Erreur import PDF:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/import/pdf/preview', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Aucun fichier' });
        }

        const data = await pdfParse(req.file.buffer);
        const codes = ImportService.extractCodes(data.text);

        res.json({
            success: true,
            codes: codes.slice(0, 50),
            total: codes.length,
            preview: data.text.slice(0, 500)
        });
    } catch (error) {
        console.error('❌ Erreur preview PDF:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================
// ROUTES - MONITORING
// =============================================

router.get('/monitor/all', async (req, res) => {
    const result = await MonitorService.monitorAllZones();
    res.json(result);
});

router.get('/monitor/zone/:zoneId', async (req, res) => {
    const result = await MonitorService.checkZoneStatus(req.params.zoneId);
    res.json(result);
});

router.get('/monitor/stats/:zoneId', async (req, res) => {
    const result = await MonitorService.getZoneStats(req.params.zoneId);
    res.json(result);
});

module.exports = router;