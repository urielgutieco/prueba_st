/**
 * STRAT & TAX - LÓGICA DEL CLIENTE PARA PRODUCCIÓN
 * ------------------------------------------------
 * ¿QUÉ ES?: Este script es el controlador de interfaz (Frontend) que gestiona el flujo de datos.
 * UTILIDAD: Actúa como puente entre el usuario y el servidor, automatizando la creación de 
 * documentos Word/ZIP y garantizando que el usuario reciba feedback en tiempo real.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- REFERENCIAS DE LOGIN ---
    const loginSection = document.getElementById('login-section');
    const formSection = document.getElementById('form-section');
    const loginForm = document.getElementById('login-form');

    // --- REFERENCIAS DE FORMULARIO DE CONTRATOS ---
    const form = document.getElementById('contract-form'); 
    const responseMessage = document.getElementById('response-message');
    const submitButton = document.querySelector('.btn-submit');

    /**
     * 0. CONTROL DE ACCESO (LOGIN)
     * UTILIDAD: Valida las credenciales antes de mostrar el formulario principal.
     */
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('username').value;
            const pass = document.getElementById('password').value;

            // Validación simple (Puedes cambiar estas credenciales)
            if (user === "admin" && pass === "strat2024") {
                loginSection.style.display = 'none';
                formSection.style.display = 'block';
            } else {
                alert("❌ Credenciales incorrectas. Intente de nuevo.");
            }
        });
    }

    /**
     * 1. MANEJO DEL FORMULARIO DE GENERACIÓN DE CONTRATOS
     */
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (responseMessage) responseMessage.style.display = 'none';
            submitButton.disabled = true;
            const originalText = submitButton.textContent;
            submitButton.textContent = '⏳ Procesando y enviando correos...';

            try {
                const formData = new FormData(form);

                const response = await fetch('/generate-word', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const contentDisposition = response.headers.get('Content-Disposition');
                    let filename = "Contratos_StratAndTax.zip";

                    if (contentDisposition && contentDisposition.includes("filename=")) {
                        const match = contentDisposition.match(/filename="(.+?)"/);
                        if (match) filename = match[1];
                    }

                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    alert("✅ Éxito: Documentos generados y enviados por correo.");
                } else {
                    const errorData = await response.json();
                    alert(`❌ Error: ${errorData.error}`);
                }

            } catch (error) {
                console.error("Error de conexión:", error);
                alert("❌ Error: No se pudo conectar con el servidor.");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        });
    }

    /**
     * 2. LÓGICA DE SINCRONIZACIÓN DE SELECT
     */
    const selServicio = document.querySelector('select[name="servicio"]');
    if (selServicio) {
        selServicio.addEventListener('change', (e) => {
            console.log("Servicio seleccionado:", e.target.value);
        });
    }
});