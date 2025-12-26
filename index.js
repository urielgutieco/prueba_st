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

const app = express();
// CORRECCIÓN 1: Definir PORT desde process.env para que Render pueda conectar
const PORT = process.env.PORT || 10000;

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

const DOCUMENT_NAMES = ['plantilla_solicitud.docx', '1.docx', '2.docx', '3.docx', '4.docx'];

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

// CORRECCIÓN 2: Ruta raíz para que Render confirme que el servicio está activo (Health Check)
app.use(express.static(path.join(__dirname, 'static')));

app.post('/generate-word', upload.single('imagen_usuario'), async (req, res) => {
    try {
        const data = req.body;
        const folder = SERVICIO_TO_DIR[data.servicio];
        if (!folder) return res.status(400).json({ error: "Servicio no reconocido." });

        const zip = new JSZip();

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

            const doc = new Docxtemplater(zipDoc, {
                modules: req.file ? [new ImageModule(imageOptions)] : [],
                paragraphLoop: true,
                linebreaks: true
            });

            doc.render({
                ...data,
                imagen_usuario: req.file ? req.file.path : null,
                fecha_generacion: new Date().toLocaleDateString('es-MX')
            });

            zip.file(`Contrato_${docName}`, doc.getZip().generate({ type: 'nodebuffer' }));
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        await transporter.sendMail({
            from: `"StratandTax" <${process.env.EMAIL_USER}>`,
            to: "uriel.gutierrenz@gmail.com",
            subject: `Nuevo Registro: ${data.razon_social || 'Sin Nombre'}`,
            text: `Se ha generado un nuevo registro para el servicio: ${data.servicio}`,
            attachments: [{ filename: `Registro_${data.r_f_c || 'documento'}.zip`, content: zipBuffer }]
        });

        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.json({ status: "OK", message: "Documentos generados y enviados por correo." });

    } catch (error) {
        console.error(error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Error interno al procesar los documentos." });
    }
});

/* =========================
   SERVER
========================= */
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});