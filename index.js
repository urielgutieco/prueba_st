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

// --- NUEVAS DEPENDENCIAS ---
const { Pool } = require('pg');
const cron = require('node-cron');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const app = express();
const PORT = process.env.PORT || 10000;

/* =========================
   CONFIGURACIÓN POSTGRESQL
========================= */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Setup DB: Crear tablas de montos y tabla de sesiones para connect-pg-simple
const setupDB = async () => {
    try {
        // Tabla de montos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS registro_montos (
                id SERIAL PRIMARY KEY,
                monto DECIMAL(15, 2) NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Tabla de sesiones (Requerida por connect-pg-simple)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "session" (
              "sid" varchar NOT NULL COLLATE "default",
              "sess" json NOT NULL,
              "expire" timestamp(6) NOT NULL
            ) WITH (OIDS=FALSE);
            ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
            CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
        `);
    } catch (err) { console.error("Error DB Setup:", err); }
};
setupDB();

/* =========================
   CONFIGURACIÓN DE SESIONES
========================= */
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: false // Ya la creamos arriba
    }),
    secret: process.env.SESSION_SECRET || 'un_secreto_muy_seguro',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 1 día
        secure: process.env.NODE_ENV === 'production', // true si usas HTTPS en Render
        httpOnly: true 
    }
}));

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
cron.schedule('59 23 * * *', () => enviarReporteSumatoria('Diario'));
cron.schedule('59 23 * * 0', () => enviarReporteSumatoria('Semanal'));
cron.schedule('59 23 15,30 * *', () => enviarReporteSumatoria('Quincenal'));
cron.schedule('0 9 5 * *', () => enviarReporteSumatoria('Mensual (Día 5)'));

/* =========================
   MIDDLEWARES
========================= */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para proteger rutas (Verifica si hay sesión)
const requireAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Sesión expirada o no iniciada' });
    }
};

/* =========================
   DIRECTORIOS Y MULTER
========================= */
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TEMPLATES_DIR = path.join(__dirname, 'template_word');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
    dest: UPLOADS_DIR,
    limits: { fileSize: 10 * 1024 * 1024 }
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
    "Servicios de control o regulacion del desarrollo urbano": "control_development_urbano",
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
    }
});

/* =========================
   RUTAS
========================= */

// Servir estáticos DESPUÉS de definir rutas de API para evitar conflictos
app.use(express.static(path.join(__dirname, 'static')));

app.post('/login', async (req, res) => {
    const { u, p } = req.body;
    const isValid = (u === process.env.ADMIN_USER && p === process.env.ADMIN_PASS) || 
                    (u === process.env.ADMIN_USER2 && p === process.env.ADMIN_PASS2);

    if (isValid) {
        // --- LÓGICA DE USUARIO ÚNICO ---
        // Buscamos si ya existe una sesión activa para este usuario y la eliminamos
        try {
            // Esto busca en el JSON de la tabla 'session' si el usuario 'u' ya tiene sesión
            await pool.query(`DELETE FROM "session" WHERE sess->>'user' = $1`, [u]);
            
            // Crear nueva sesión
            req.session.user = u;
            res.json({ success: true });
        } catch (err) {
            console.error("Error al gestionar sesión única:", err);
            res.status(500).json({ success: false, message: 'Error de servidor' });
        }
    } else {
        res.status(401).json({ success: false, message: 'No autorizado' });
    }
});

// Ruta para Logout
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Ruta protegida con requireAuth
app.post('/generate-word', requireAuth, upload.single('imagen_usuario'), async (req, res) => {
    try {
        const data = req.body;

        const montoRecibido = parseFloat(data.monto_de_la_operacion_sin_iva);
        if (!isNaN(montoRecibido)) {
            await pool.query("INSERT INTO registro_montos (monto) VALUES ($1)", [montoRecibido]);
        }

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
        const destinatarios = [process.env.EMAIL_DESTINO, process.env.EMAIL_DESTINO2].filter(Boolean).join(', ');

        await transporter.sendMail({
            from: `"StratandTax" <${process.env.EMAIL_USER}>`,
            to: destinatarios, 
            subject: `Nuevo Registro: ${data.razon_social || 'Sin Nombre'}`,
            text: `Se ha generado un nuevo registro para el servicio: ${data.servicio}`,
            attachments: [{ 
                filename: `Registro_${data.r_f_c || 'documento'}.zip`, 
                content: zipBuffer 
            }]
        });

        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ status: "OK"});

    } catch (error) {
        console.error(error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Error interno al procesar los documentos." });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});