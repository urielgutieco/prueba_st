const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const nodemailer = require('nodemailer');
const JSZip = require('jszip');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();
const { Pool } = require('pg');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Setup Inicial de Tablas
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS registro_montos (
                id SERIAL PRIMARY KEY,
                monto DECIMAL(15, 2) NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS sesiones_activas (
                usuario TEXT PRIMARY KEY,
                token TEXT NOT NULL,
                ultimo_acceso TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (err) { console.error("Error DB Setup:", err); }
})();

/* CONFIGURACIÓN DE CORREO */
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const enviarReporteSumatoria = async (periodo) => {
    try {
        const res = await pool.query("SELECT SUM(monto) as total FROM registro_montos");
        const total = res.rows[0].total || 0;
        await transporter.sendMail({
            from: `"Sistema de Facturación" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_REPORTE,
            subject: `Reporte de Facturación - ${periodo}`,
            text: `Total acumulado: $${total} (Sin IVA). Periodo: ${periodo}`
        });
    } catch (e) { console.error(e); }
};

/* TAREAS PROGRAMADAS */
cron.schedule('59 23 * * *', () => enviarReporteSumatoria('Diario'));
cron.schedule('0 9 5 * *', () => enviarReporteSumatoria('Mensual'));

/* MIDDLEWARES */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const upload = multer({ dest: UPLOADS_DIR });

const SERVICIO_TO_DIR = {
    "Servicios de construccion de unidades unifamiliares": "construccion_unifamiliar",
    "Servicios de reparacion o ampliacion o remodelacion de viviendas unifamiliares": "reparacion_remodelacion_unifamiliar",
    "Servicio de remodelacion general de viviendas unifamiliares": "remodelacion_general",
    "Servicios de reparacion de casas moviles en el sitio": "reparacion_casas_moviles",
    "Servicios de construccion y reparacion de patios y terrazas": "patios_terrazas",
    "Servico de reparacion por daños ocasionados por fuego de viviendas unifamiliares": "reparacion_por_fuego",
    "Servicio de construccion de casas unifamiliares nuevas": "construccion_unifamiliar_nueva",
    "Servicio de instalacion de casas unifamiliares prefabricadas": "instalacion_prefabricadas",
    "Servicio de conatruccion de casas en la ciudad o casas jardin unifamiliares nuevas": "construccion_casas_ciudad_jardin",
    "Dasarrollo urbano": "desarrollo_urbano",
    "Servicio de planificacion de la ordenacion urbana": "planificacion_ordenacion_urbana",
    "Servicio de administracion de tierras urbanas": "administracion_tierras_urbanas",
    "Servicio de programacion de inversiones urbanas": "programacion_inversiones_urbanas",
    "Servicio de reestructuracion de barrios marginales": "reestructuracion_barrios_marginales",
    "Servicios de alumbrado urbano": "alumbrado_urbano",
    "Servicios de control o regulacion del desarrollo urbano": "control_desarrollo_urbano",
    "Servicios de estandares o regulacion de edificios urbanos": "estandares_regulacion_edificios",
    "Servicios comunitarios urbanos": "comunitarios_urbanos",
    "Servicios de administracion o gestion de proyectos o programas urbanos": "gestion_proyectos_programas_urbanos",
    "Ingenieria civil": "ingenieria_civil",
    "Ingenieria de carreteras": "ingenieria_carreteras",
    "Ingenieria deinfraestructura de instalaciones o fabricas": "infraestructura_instalaciones_fabricas",
    "Servicios de mantenimiento e instalacion de equipo pesado": "mantenimiento_instalacion_equipo_pesado",
    "Servicio de mantenimiento y reparacion de equipo pesado": "mantenimiento_reparacion_equipo_pesado"
};

const DOCUMENT_NAMES = ['Acta_de_entrega_recepcion.docx', 'Bitacora_de_avances_de_obra.docx', 'Contrato_de_prestación_de_servicios.docx', 'Cotizacion_de_servicios.docx', 'Narrativas_de_materialidad.docx', 'Orden_de_servicio.docx'];

/* RUTAS */
app.post('/login', async (req, res) => {
    const { u, p } = req.body;
    const isValid = (u === process.env.ADMIN_USER && p === process.env.ADMIN_PASS) || (u === process.env.ADMIN_USER2 && p === process.env.ADMIN_PASS2);
    if (!isValid) return res.status(401).json({ success: false });

    const sessionToken = Math.random().toString(36).substring(2) + Date.now();
    await pool.query(
        `INSERT INTO sesiones_activas (usuario, token) VALUES ($1, $2)
         ON CONFLICT (usuario) DO UPDATE SET token = $2, ultimo_acceso = CURRENT_TIMESTAMP`,
        [u, sessionToken]
    );
    res.json({ success: true, token: sessionToken, user: u });
});

app.post('/verify-session', async (req, res) => {
    const { u, token } = req.body;
    const result = await pool.query('SELECT token FROM sesiones_activas WHERE usuario = $1', [u]);
    if (result.rows.length && result.rows[0].token === token) return res.json({ valid: true });
    res.json({ valid: false });
});

const validarSesion = async (req, res, next) => {
    const u = req.headers['x-user'];
    const token = req.headers['x-session-token'];
    if (!u || !token) return res.status(401).json({ error: 'Sesión requerida' });

    const result = await pool.query('SELECT token FROM sesiones_activas WHERE usuario = $1', [u]);
    if (!result.rows.length || result.rows[0].token !== token) return res.status(401).json({ error: 'Sesión inválida' });

    await pool.query('UPDATE sesiones_activas SET ultimo_acceso = CURRENT_TIMESTAMP WHERE usuario = $1', [u]);
    next();
};

app.post('/generate-word', validarSesion, upload.single('imagen_usuario'), async (req, res) => {
    try {
        const data = req.body;
        const montoRecibido = parseFloat(data.monto_de_la_operacion_sin_iva);
        if (!isNaN(montoRecibido)) await pool.query("INSERT INTO registro_montos (monto) VALUES ($1)", [montoRecibido]);

        const folder = SERVICIO_TO_DIR[data.servicio];
        if (!folder) return res.status(400).json({ error: "Servicio no reconocido." });

        const zip = new JSZip();
        const imageOptions = {
            centered: false,
            getImage: (tagValue) => fs.readFileSync(tagValue),
            getSize: () => [150, 150]
        };

        for (const docName of DOCUMENT_NAMES) {
            const templatePath = path.join(__dirname, 'template_word', folder, docName);
            if (!fs.existsSync(templatePath)) continue;

            const content = fs.readFileSync(templatePath);
            const zipDoc = new PizZip(content);
            const doc = new Docxtemplater(zipDoc, {
                modules: req.file ? [new ImageModule(imageOptions)] : [],
                paragraphLoop: true, linebreaks: true
            });

            doc.render({
                ...data,
                imagen_usuario: req.file ? req.file.path : null,
                fecha_generacion: new Date().toLocaleDateString('es-MX')
            });
            zip.file(`Contrato_${docName}`, doc.getZip().generate({ type: 'nodebuffer' }));
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        const destinatarios = [process.env.EMAIL_DESTINO, process.env.EMAIL_DESTINO2].filter(Boolean).join(', ');

        await transporter.sendMail({
            from: `"StratandTax" <${process.env.EMAIL_USER}>`,
            to: destinatarios,
            subject: `Nuevo Registro: ${data.razon_social || 'Sin Nombre'}`,
            text: `Servicio: ${data.servicio}`,
            attachments: [{ filename: `Registro_${data.r_f_c || 'documento'}.zip`, content: zipBuffer }]
        });

        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error interno." });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));