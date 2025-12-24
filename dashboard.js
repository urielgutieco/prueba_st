<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Dashboard Cliente</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #0f172a;
      color: #e5e7eb;
    }

    .wrapper {
      display: flex;
      min-height: 100vh;
    }

    .sidebar {
      width: 240px;
      background: #020617;
      padding: 20px;
    }

    .sidebar h2 {
      color: #38bdf8;
    }

    .sidebar a {
      display: block;
      color: #94a3b8;
      text-decoration: none;
      margin: 10px 0;
    }

    .sidebar a:hover {
      color: white;
    }

    .main {
      flex: 1;
      padding: 30px;
    }

    .card {
      background: #020617;
      border-radius: 10px;
      padding: 25px;
      margin-bottom: 25px;
    }

    h3, h2 {
      margin-top: 0;
    }

    /* Estilos para el formulario integrado */
    .form-group {
      margin-bottom: 15px;
    }

    .form-group label {
      display: block;
      font-size: 13px;
      margin-bottom: 6px;
      color: #cbd5f5;
    }

    .form-group input, 
    .form-group select, 
    .form-group textarea {
      width: 100%;
      padding: 12px;
      border-radius: 6px;
      border: none;
      background: #1e293b;
      color: white;
      box-sizing: border-box;
    }

    .btn-submit {
      margin-top: 20px;
      padding: 14px 26px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      font-weight: bold;
    }

    #logout-btn {
      margin-top: 20px;
      padding: 10px;
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      padding: 10px;
      border-bottom: 1px solid #1e293b;
      text-align: left;
    }

    .message {
      padding: 10px;
      margin-bottom: 15px;
      border-radius: 5px;
      background: #1e293b;
    }

    @media (max-width: 800px) {
      .sidebar { display: none; }
    }
  </style>
</head>
<body>

<div class="wrapper">

  <div class="sidebar">
    <h2>Strat &amp; Tax</h2>
    <a href="#">Dashboard</a>
    <a href="#">Generar</a>
    <a href="#">Historial</a>
    <a href="#" onclick="logout()">Salir</a>
  </div>

  <div class="main">

    <div id="form-solicitud" class="card">
      <h2>Generar registro.</h2>
      <p style="text-align:center;"></p>
      <div id="response-message" class="message" style="display: none;"></div>

      <form id="solicitudForm" enctype="multipart/form-data">

        <div class="form-group">
          <label for="servicio">Selecciona un servicio (*)</label>
          <select id="servicio" name="servicio" required>
            <option value="" disabled selected>--- Elige una opción ---</option>
            <option value="Servicios de construccion de unidades unifamiliares">Servicios de construccion de unidades unifamiliares</option>
            <option value="Servicios de reparacion o ampliacion o remodelacion de viviendas unifamiliares">Servicios de reparacion o ampliacion o remodelacion de viviendas unifamiliares</option>
            <option value="Servicio de remodelacion general de viviendas unifamiliares">Servicio de remodelacion general de viviendas unifamiliares</option>
            <option value="Servicios de reparacion de casas moviles en el sitio">Servicios de reparacion de casas moviles en el sitio</option>
            <option value="Servicios de construccion y reparacion de patios y terrazas">Servicios de construccion y reparacion de patios y terrazas</option>
            <option value="Servico de reparacion por daños ocasionados por fuego de viviendas unifamiliares">Servico de reparacion por daños ocasionados por fuego de viviendas unifamiliares</option>
            <option value="Servicio de construccion de casas unifamiliares nuevas">Servicio de construccion de casas unifamiliares nuevas</option>
            <option value="Servicio de instalacion de casas unifamiliares prefabricadas">Servicio de instalacion de casas unifamiliares prefabricadas</option>
            <option value="Servicio de construccion de casas en la ciudad o casas jardin unifamiliares nuevas">Servicio de construccion de casas en la ciudad o casas jardin unifamiliares nuevas</option>
            <option value="Dasarrollo urbano">Dasarrollo urbano</option>
            <option value="Servicio de planificacion de la ordenacion urbana">Servicio de planificacion de la ordenacion urbana</option>
            <option value="Servicio de administracion de tierras urbanas">Servicio de administracion de tierras urbanas</option>
            <option value="Servicio de programacion de inversiones urbanas">Servicio de programacion de inversiones urbanas</option>
            <option value="Servicio de reestructuracion de barrios marginales">Servicio de reestructuracion de barrios marginales</option>
            <option value="Servicios de alumbrado urbano">Servicios de alumbrado urbano</option>
            <option value="Servicios de control o regulacion del desarrollo urbano">Servicios de control o regulacion del desarrollo urbano</option>
            <option value="Servicios de estandares o regulacion de edificios urbanos">Servicios de estandares o regulacion de edificios urbanos</option>
            <option value="Servicios comunitarios urbanos">Servicios comunitarios urbanos</option>
            <option value="Servicios de administracion o gestion de proyectos o programas urbanos">Servicios de administracion o gestion de proyectos o programas urbanos</option>
            <option value="Ingenieria civil">Ingenieria civil</option>
            <option value="Ingenieria de carreteras">Ingenieria de carreteras</option>
            <option value="Ingenieria deinfraestructura de instalaciones o fabricas">Ingenieria deinfraestructura de instalaciones o fabricas</option>
            <option value="Servicios de mantenimiento e instalacion de equipo pesado">Servicios de mantenimiento e instalacion de equipo pesado</option>
            <option value="Servicio de mantenimiento y reparacion de equipo pesado">Servicio de mantenimiento y reparacion de equipo pesado</option>
          </select>
          <input type="hidden" id="descripcion_del_servicio" name="descripcion_del_servicio">
        </div>

        <div class="form-group">
          <label for="razon_social">Razón Social (*)</label>
          <input type="text" id="razon_social" name="razon_social" required>
        </div>

        <div class="form-group">
          <label for="r_f_c">R.F.C (*)</label>
          <input type="text" id="r_f_c" name="r_f_c" required>
        </div>

        <div class="form-group">
          <label for="domicilio_del_cliente">Domicilio del Cliente</label>
          <input type="text" id="domicilio_del_cliente" name="domicilio_del_cliente">
        </div>

        <div class="form-group">
          <label for="telefono_del_cliente">Teléfono del Cliente</label>
          <input type="tel" id="telefono_del_cliente" name="telefono_del_cliente">
        </div>

        <div class="form-group">
          <label for="correo_del_cliente">Correo del Cliente (*)</label>
          <input type="email" id="correo_del_cliente" name="correo_del_cliente" required>
        </div>

        <div class="form-group">
          <label for="fecha_de_operacion">Fecha de Operacion</label>
          <input type="date" id="fecha_de_operacion" name="fecha_de_operacion">
        </div>

        <div class="form-group">
          <label for="fecha_de_inicio_del_servicio">Fecha de Inicio Estimada</label>
          <input type="date" id="fecha_de_inicio_del_servicio" name="fecha_de_inicio_del_servicio">
        </div>

        <div class="form-group">
          <label for="fecha_de_conclusion_del_servicio">Fecha de Conclusión Estimada</label>
          <input type="date" id="fecha_de_conclusion_del_servicio" name="fecha_de_conclusion_del_servicio">
        </div>

        <div class="form-group">
          <label for="monto_de_la_operacion_sin_iva">Monto de la Operación (Sin IVA) (*)</label>
          <input type="number" id="monto_de_la_operacion_sin_iva" name="monto_de_la_operacion_sin_iva" step="0.01" required>
        </div>

        <div class="form-group">
          <label for="forma_de_pago">Forma de Pago</label>
          <input type="text" id="forma_de_pago" name="forma_de_pago">
        </div>

        <div class="form-group">
          <label for="cantidad">Cantidad de Unidades</label>
          <input type="number" id="cantidad" name="cantidad" step="1">
        </div>

        <div class="form-group">
          <label for="numero_de_contrato">Número de Contrato</label>
          <input type="text" id="numero_de_contrato" name="numero_de_contrato">
        </div>

        <div class="form-group">
          <label for="unidad">Unidad de Medida (Ej: Servicio, Hora, Documento)</label>
          <input type="text" id="unidad" name="unidad">
        </div>

        <div class="form-group">
          <label for="factura_relacionada_con_la_operacion">Factura Relacionada con la Operación</label>
          <input type="text" id="factura_relacionada_con_la_operacion" name="factura_relacionada_con_la_operacion">
        </div>

        <div class="form-group">
          <label for="nombre_completo_de_la_persona_que_firma_la_solicitud">Nombre Completo de la Persona que Firma (*)</label>
          <input type="text" id="nombre_completo_de_la_persona_que_firma_la_solicitud" name="nombre_completo_de_la_persona_que_firma_la_solicitud" required>
        </div>

        <div class="form-group">
          <label for="cargo_de_la_persona_que_firma_la_solicitud">Cargo de la Persona que Firma</label>
          <input type="text" id="cargo_de_la_persona_que_firma_la_solicitud" name="cargo_de_la_persona_que_firma_la_solicitud">
        </div>

        <div class="form-group">
          <label for="informe_si_cuenta_con_fotografias_videos_o_informacion_adicion">¿Cuenta con fotografías, videos o información adicional? (Describa)</label>
          <textarea id="informe_si_cuenta_con_fotografias_videos_o_informacion_adicion" name="informe_si_cuenta_con_fotografias_videos_o_informacion_adicion" rows="2"></textarea>
        </div>

        <div class="form-group">
          <label for="comentarios">Comentarios Finales (Observaciones, notas)</label>
          <textarea id="comentarios" name="comentarios" rows="3"></textarea>
        </div>

        <div class="form-group">
          <label for="imagen_usuario">Cargar imagen para insertar en Word</label>
          <input type="file" id="imagen_usuario" name="imagen_usuario" accept="image/*">
        </div>

        <button type="submit" class="btn-submit">Generar Solicitud y Descargar Word</button>

      </form>
    </div>

    <button id="logout-btn" onclick="logout()">
      Cerrar sesión
    </button>

    <div class="card">
      <h3>Historial</h3>
      <table>
        <thead>
          <tr>
            <th>Pack</th>
            <th>Fecha</th>
            <th>Email</th>
            <th>ZIP</th>
          </tr>
        </thead>
        <tbody id="historyTable"></tbody>
      </table>
    </div>

  </div>
</div>

<script src="/dashboard.js"></script>

</body>
</html>