const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const nodemailer = require('nodemailer');
const JSZip = require('jszip');
const helmet = require('helmet'); // Seguridad de cabeceras
const compression = require('compression'); // Compresión de respuesta para mayor velocidad
require('dotenv').config();

const app = express();

// --- Middlewares de Producción ---
// Helmet ayuda a proteger la app de vulnerabilidades web comunes
app.use(helmet({
    contentSecurityPolicy: false, 
}));
// Compression reduce el tamaño del cuerpo de la respuesta para mejorar el rendimiento
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (CSS, JS cliente, Imágenes)
app.use(express.static(path.join(__dirname, 'static')));

// --- Configuración de Directorios ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TEMPLATES_DIR = path.join(__dirname, 'template_word');

// Asegurar que la carpeta de subida existe
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuración de Multer para subida de archivos
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // Límite de seguridad: 10MB
});

// --- Mapeo de Servicios a Carpetas ---
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
    "Servicio de mantenimiento y reparacion de equipo pesado": "mantenimiento_reparacion_equipo_pesado",
};

const DOCUMENT_NAMES = ['plantilla_solicitud.docx', '1.docx', '2.docx', '3.docx', '4.docx'];

// --- Rutas ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.post('/generate-word', upload.single('imagen_usuario'), async (req, res) => {
    try {
        const data = req.body;
        const servicio = data.servicio;
        const folder = SERVICIO_TO_DIR[servicio];

        if (!folder) return res.status(400).json({ error: "Servicio no reconocido." });

        const zip = new JSZip();

        // Configuración módulo de imágenes para el documento Word
        const imageOptions = {
            centered: false,
            getImage: (tagValue) => fs.readFileSync(tagValue),
            getSize: () => [150, 150]
        };

        for (const docName of DOCUMENT_NAMES) {
            const templatePath = path.join(TEMPLATES_DIR, folder, docName);

            if (fs.existsSync(templatePath)) {
                const content = fs.readFileSync(templatePath);
                const zipDoc = new PizZip(content);

                const doc = new Docxtemplater(zipDoc, {
                    modules: req.file ? [new ImageModule(imageOptions)] : [],
                    paragraphLoop: true,
                    linebreaks: true,
                });

                doc.render({
                    ...data,
                    imagen_usuario: req.file ? req.file.path : null,
                    fecha_generacion: new Date().toLocaleDateString('es-MX')
                });

                const buf = doc.getZip().generate({ type: 'nodebuffer' });
                zip.file(`Contrato_${docName}`, buf);
            }
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        // --- Configuración de Correo Electrónico ---
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true, 
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: `"Sistema SuperAdmin" <${process.env.EMAIL_USER}>`,
            to: "uriel.gutierrenz@gmail.com, urielgutieco@gmail.com",
            subject: `Nuevo Registro: ${data.razon_social || 'Sin Nombre'}`,
            text: `Se ha generado un nuevo registro para el servicio: ${servicio}`,
            attachments: [{
                filename: `Registro_${data.r_f_c || 'documento'}.zip`,
                content: zipBuffer
            }]
        });

        // Limpieza de archivos temporales para optimizar espacio en el servidor
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        // Respuesta al cliente con el archivo ZIP
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename=Registro_${data.r_f_c || 'descarga'}.zip`,
            'Content-Length': zipBuffer.length
        }).send(zipBuffer);

    } catch (error) {
        console.error("Critical Error:", error);
        // Asegurar limpieza de archivos incluso en caso de error
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Error interno al procesar los documentos." });
    }
});

// --- Inicio del Servidor ---
// El puerto 10000 es el estándar de Render, pero usa el asignado por el entorno
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});