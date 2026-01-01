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

// --- INICIO DE NUEVAS DEPENDENCIAS ---
const { Pool } = require('pg');
const cron = require('node-cron');
// --- FIN DE NUEVAS DEPENDENCIAS ---

const app = express();
const PORT = process.env.PORT || 10000;

/* =========================
   CONFIGURACIÓN POSTGRESQL (PERSISTENCIA)
========================= */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Crear tabla automáticamente si no existe al iniciar
const setupDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS registro_montos (
                id SERIAL PRIMARY KEY,
                monto DECIMAL(15, 2) NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (err) { console.error("Error DB Setup:", err); }
};
setupDB();

/* =========================
   FUNCIONES DE REPORTE POR CORREO
========================= */
const enviarReporteSumatoria = async (periodo) => {
    try {
        const res = await pool.query("SELECT SUM(monto) as total FROM registro_montos");
        const total = res.rows[0].total || 0;

        await transporter.sendMail({
            from: `"Sistema de Facturación" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_REPORTE,
            subject: `Reporte de Facturación Acumulada - ${periodo}`,
            text: `El total acumulado registrado para facturación es: $${total} (Sin IVA).\nPeriodo: ${periodo}`
        });
    } catch (error) { console.error("Error en reporte cron:", error); }
};

/* =========================
   TAREAS PROGRAMADAS (CRON)
========================= */
// Cada día a las 23:59
cron.schedule('59 23 * * *', () => enviarReporteSumatoria('Diario'));
// Cada semana (Domingo 23:59)
cron.schedule('59 23 * * 0', () => enviarReporteSumatoria('Semanal'));
// Cada quince días (Día 15 y 30 a las 23:59)
cron.schedule('59 23 15,30 * *', () => enviarReporteSumatoria('Quincenal'));
// Día 5 de cada mes a las 09:00 AM
cron.schedule('0 9 5 * *', () => enviarReporteSumatoria('Mensual (Día 5)'));

/* =========================
   MIDDLEWARES
========================= */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));

/* =========================
   DIRECTORIOS
========================= */
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TEMPLATES_DIR = path.join(__dirname, 'template_word');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* =========================
   MULTER
========================= */
const upload = multer({
    dest: UPLOADS_DIR,
    limits: { fileSize: 10 * 1024 * 1024 }
});

/* =========================
   CONSTANTES
========================= */
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

/* =========================
   TRANSPORTER (REUTILIZABLE)
========================= */
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
});

/* =========================
   RUTAS
========================= */

app.use(express.static(path.join(__dirname, 'static')));

app.post('/login', (req, res) => {
    const { u, p } = req.body;
    const isValid = (u === process.env.ADMIN_USER && p === process.env.ADMIN_PASS) || 
                    (u === process.env.ADMIN_USER2 && p === process.env.ADMIN_PASS2);

    if (isValid) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'No autorizado' });
    }
});

app.post('/generate-word', upload.single('imagen_usuario'), async (req, res) => {
    try {
        const data = req.body;

        // 1. Persistencia en DB (sin detener el flujo)
        try {
            const monto = parseFloat(data.monto_de_la_operacion_sin_iva);
            if (!isNaN(monto)) await pool.query("INSERT INTO registro_montos (monto) VALUES ($1)", [monto]);
        } catch (dbErr) { console.error("DB Error:", dbErr); }

        const folder = SERVICIO_TO_DIR[data.servicio];
        if (!folder) return res.status(400).json({ error: "Carpeta de servicio no encontrada." });

        const zip = new JSZip();

        // 2. Configuración de imágenes solo si existe el archivo
        const imageOptions = {
            centered: false,
            getImage: (tagValue) => fs.readFileSync(tagValue),
            getSize: () => [150, 150]
        };

        for (const docName of DOCUMENT_NAMES) {
            const templatePath = path.join(TEMPLATES_DIR, folder, docName);
            if (!fs.existsSync(templatePath)) continue;

            const content = fs.readFileSync(templatePath);
            const zipDoc = new PizZip(content);

            // Solo cargar ImageModule si hay un archivo subido
            const doc = new Docxtemplater(zipDoc, {
                modules: req.file ? [new ImageModule(imageOptions)] : [],
                paragraphLoop: true,
                linebreaks: true
            });

            // 3. RENDERIZADO: Pasa los datos del formulario al Word
            doc.render({
                ...data,
                // En tu Word usa la etiqueta {%foto} para mostrar la imagen
                foto: req.file ? req.file.path : null 
            });

            zip.file(docName, doc.getZip().generate({ type: 'nodebuffer' }));
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        // 4. Envío por Email
        const destinatarios = [process.env.EMAIL_DESTINO, process.env.EMAIL_DESTINO2].filter(Boolean).join(', ');
        await transporter.sendMail({
            from: `"StratandTax" <${process.env.EMAIL_USER}>`,
            to: destinatarios,
            subject: `Registro: ${data.razon_social || 'Nuevo Cliente'}`,
            text: `Servicio: ${data.servicio}`,
            attachments: [{ 
                filename: `Expediente_${data.r_f_c || 'cliente'}.zip`, 
                content: zipBuffer 
            }]
        });

        // Limpiar archivo temporal de la carpeta /uploads
        if (req.file) fs.unlinkSync(req.file.path);

        res.json({ status: "OK" });

    } catch (error) {
        console.error("Error procesando Word:", error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Error interno al generar documentos." });
    }
});

/* =========================
   SERVER
========================= */
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});