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
const sharp = require('sharp');
require('dotenv').config();

const { Pool } = require('pg');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

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

cron.schedule('59 23 * * *', () => enviarReporteSumatoria('Diario'));
cron.schedule('59 23 * * 0', () => enviarReporteSumatoria('Semanal'));
cron.schedule('59 23 15,30 * *', () => enviarReporteSumatoria('Quincenal'));
cron.schedule('0 9 5 * *', () => enviarReporteSumatoria('Mensual (Día 5)'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TEMPLATES_DIR = path.join(__dirname, 'template_word');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
    dest: UPLOADS_DIR,
    limits: { fileSize: 15 * 1024 * 1024 } 
});

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

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 20000,
    socketTimeout: 60000
});

app.post('/login', (req, res) => {
    const { u, p } = req.body;
    const isValid = (u === process.env.ADMIN_USER && p === process.env.ADMIN_PASS) || 
                    (u === process.env.ADMIN_USER2 && p === process.env.ADMIN_PASS2) || 
                    (u === process.env.ADMIN_USER3 && p === process.env.ADMIN_PASS3);
    if (isValid) res.json({ success: true });
    else res.status(401).json({ success: false, message: 'No autorizado' });
});

app.post('/generate-word', upload.single('imagen_usuario'), async (req, res) => {
    let optimizedImagePath = null;
    try {
        const data = req.body;
        const montoRecibido = parseFloat(data.monto_de_la_operacion_sin_iva);
        if (!isNaN(montoRecibido)) {
            await pool.query("INSERT INTO registro_montos (monto) VALUES ($1)", [montoRecibido]);
        }

        const folder = SERVICIO_TO_DIR[data.servicio];
        if (!folder) return res.status(400).json({ error: "Servicio no reconocido." });

        const zip = new JSZip();

        // --- OPTIMIZACIÓN AGRESIVA PARA EVITAR ERROR 552 ---
        if (req.file) {
            optimizedImagePath = req.file.path + "_final.jpg";
            await sharp(req.file.path)
                .resize(500, 500, { fit: 'inside' }) // Tamaño pequeño pero suficiente para Word
                .flatten({ background: '#ffffff' }) // Quita transparencia si es PNG
                .jpeg({ quality: 50, progressive: true, chromaSubsampling: '4:2:0' }) 
                .toFile(optimizedImagePath);
            
            data.imagen_usuario = optimizedImagePath;
        }

        const imageOptions = {
            centered: false,
            getImage: (tagValue) => fs.readFileSync(tagValue),
            getSize: () => [150, 150] // Tamaño dentro del Word
        };

        for (const docName of DOCUMENT_NAMES) {
            const templatePath = path.join(TEMPLATES_DIR, folder, docName);
            if (!fs.existsSync(templatePath)) continue;

            const content = fs.readFileSync(templatePath);
            const zipDoc = new PizZip(content);
            const doc = new Docxtemplater(zipDoc, {
                modules: req.file ? [new ImageModule(imageOptions)] : [],
                paragraphLoop: true,
                linebreaks: true
            });

            doc.render({
                ...data,
                fecha_generacion: new Date().toLocaleDateString('es-MX')
            });

            zip.file(`Documento_${docName}`, doc.getZip().generate({ type: 'nodebuffer' }));
        }

        const zipBuffer = await zip.generateAsync({ 
            type: 'nodebuffer',
            compression: "DEFLATE",
            compressionOptions: { level: 9 } 
        });

        const destinatarios = [process.env.EMAIL_DESTINO, process.env.EMAIL_DESTINO2, process.env.EMAIL_DESTINO3].filter(Boolean).join(', ');

        await transporter.sendMail({
            from: `"Sistema StratandTax" <${process.env.EMAIL_USER}>`,
            to: destinatarios, 
            subject: `Expediente: ${data.razon_social || 'Nuevo Registro'}`,
            text: `Se adjuntan los 6 documentos generados para el servicio: ${data.servicio}`,
            attachments: [{ 
                filename: `Expediente_${data.r_f_c || 'archivos'}.zip`, 
                content: zipBuffer 
            }]
        });

        // Limpieza
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        if (optimizedImagePath && fs.existsSync(optimizedImagePath)) fs.unlinkSync(optimizedImagePath);

        res.json({ status: "OK"});

    } catch (error) {
        console.error("DETALLE DEL ERROR:", error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        if (optimizedImagePath && fs.existsSync(optimizedImagePath)) fs.unlinkSync(optimizedImagePath);
        
        // Respuesta clara al cliente
        res.status(500).json({ 
            error: "El archivo ZIP es demasiado pesado para enviarse por correo. Intente con una imagen más pequeña o contacte soporte." 
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});