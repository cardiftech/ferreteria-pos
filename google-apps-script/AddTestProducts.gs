/**
 * PRODUCTOS DE PRUEBA — FerrePOS
 * ================================
 * Agrega 500 productos (250 Pintura + 250 Fijación) usando bulk insert.
 *
 * CÓMO USARLO:
 *  1. En tu proyecto de Apps Script, crea un nuevo archivo (.gs) y pega este código.
 *  2. Selecciona la función addTestProducts en el menú desplegable.
 *  3. Haz clic en ▶ Ejecutar (solo una vez).
 *  4. Vuelve a la app y presiona el botón Sincronizar (↺).
 */

// Reutiliza el SS_ID del archivo Code.gs (deben estar en el mismo proyecto)

function addTestProducts() {
  var sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(TAB_INVENTORY);
  var products = generatePintura_().concat(generateFijacion_());

  var startRow = sheet.getLastRow() + 1;
  // setValues es ~100x más rápido que appendRow por fila
  sheet.getRange(startRow, 1, products.length, 7).setValues(products);

  SpreadsheetApp.getUi().alert(
    '✅ ' + products.length + ' productos de prueba agregados.\n' +
    'Ahora presiona Sincronizar (↺) en la app.'
  );
}


// ── PINTURA (250 productos) ───────────────────────────────────────────────────

function generatePintura_() {
  var rows = [];
  var seq  = 10000;

  function add(nombre, precio, stock, min) {
    var bc = '7501' + String(seq++).padStart(9, '0');
    rows.push([bc, nombre, 'Pintura', stock, precio, '', min || Math.max(3, Math.round(stock * 0.15))]);
  }

  // Pintura Látex — 10 colores × 3 tamaños = 30
  var latexColores = ['Blanca','Marfil','Crema','Beige','Gris Claro','Gris Oscuro','Verde Jade','Azul Cielo','Amarillo Suave','Salmón'];
  latexColores.forEach(function(c) {
    add('Pintura Látex '+c+' 1L',   45, 35, 7);
    add('Pintura Látex '+c+' 4L',  158, 22, 5);
    add('Pintura Látex '+c+' 19L', 625,  8, 2);
  });

  // Pintura Esmalte — 10 colores × 3 tamaños = 30
  var esmalteColores = ['Blanco','Negro','Rojo Vivo','Azul Marino','Verde Botella','Amarillo','Naranja','Café','Gris Acero','Plateado'];
  esmalteColores.forEach(function(c) {
    add('Pintura Esmalte '+c+' 1/4L',  38, 40, 8);
    add('Pintura Esmalte '+c+' 1L',   118, 28, 6);
    add('Pintura Esmalte '+c+' 4L',   395, 12, 3);
  });

  // Anticorrosivo — 5 colores × 2 tamaños = 10
  ['Rojo Óxido','Negro','Gris','Café','Aluminio'].forEach(function(c) {
    add('Anticorrosivo '+c+' 1L', 95, 20, 4);
    add('Anticorrosivo '+c+' 4L',315, 10, 2);
  });

  // Pintura Spray — 15 colores = 15
  ['Negro Mate','Negro Brillante','Blanco','Gris','Rojo','Azul Eléctrico','Verde','Amarillo','Naranja',
   'Plata','Dorado','Cromo','Transparente','Café','Beige'].forEach(function(c) {
    add('Pintura Spray '+c+' 400ml', 28, 55, 10);
  });

  // Barniz — 4 tipos × 3 tamaños = 12
  ['Interior','Exterior','Marino','Poliuretano'].forEach(function(t) {
    add('Barniz '+t+' 1/4L',  42, 20, 4);
    add('Barniz '+t+' 1L',   138, 18, 4);
    add('Barniz '+t+' 4L',   450, 10, 2);
  });

  // Thinner — 3 tipos × 3 tamaños = 9
  ['Estándar','Sintético','Epóxico'].forEach(function(t) {
    add('Thinner '+t+' 1L',  22, 40, 8);
    add('Thinner '+t+' 4L',  72, 25, 5);
    add('Thinner '+t+' 19L',290, 10, 2);
  });

  // Aguarrás — 3 tamaños = 3
  add('Aguarrás 1L',  18, 45, 9);
  add('Aguarrás 4L',  58, 28, 6);
  add('Aguarrás 19L',238, 10, 2);

  // Lija seca — 10 granos = 10
  [40,60,80,100,120,150,180,220,320,400].forEach(function(g) {
    add('Lija Seca #'+g,  8, 90, 15);
  });

  // Lija al agua — 8 granos = 8
  [120,150,180,220,320,400,600,1000].forEach(function(g) {
    add('Lija al Agua #'+g, 9, 70, 12);
  });

  // Brochas — 2 tipos × 5 tamaños = 10
  ['Cerda Natural','Angular'].forEach(function(t) {
    ['1"','1.5"','2"','3"','4"'].forEach(function(s) {
      add('Brocha '+t+' '+s, t==='Cerda Natural'?15:18, 30, 6);
    });
  });

  // Rodillos — 4 tipos × 3 tamaños = 12
  ['Lana','Pelo Corto','Esponja','Microfibra'].forEach(function(t) {
    ['4"','7"','9"'].forEach(function(s) {
      add('Rodillo '+t+' '+s, 22, 25, 5);
    });
  });

  // Masilla — 3 tipos × 3 tamaños = 9
  ['Plástica','al Agua','Acrílica'].forEach(function(t) {
    add('Masilla '+t+' 500g',  18, 22, 5);
    add('Masilla '+t+' 1kg',   32, 18, 4);
    add('Masilla '+t+' 4kg',  108, 10, 2);
  });

  // Impermeabilizante — 3 tipos × 3 tamaños = 9
  ['Transparente','Blanco','Gris'].forEach(function(t) {
    add('Impermeabilizante '+t+' 1L',  72, 18, 4);
    add('Impermeabilizante '+t+' 4L', 248, 10, 2);
    add('Impermeabilizante '+t+' 19L',985,  5, 1);
  });

  // Fondo / Sellador — 4 tipos × 2 tamaños = 8
  ['Fondo Blanco','Fondo Gris','Sellador Acrílico','Sellador Vinílico'].forEach(function(t) {
    add(t+' 1L',  55, 18, 4);
    add(t+' 4L', 188, 10, 2);
  });

  // Accesorios sueltos — completan hasta 250
  var accs = [
    ['Cinta Enmascarar 18mm x 50m',12,65,12],  ['Cinta Enmascarar 24mm x 50m',15,60,10],
    ['Cinta Enmascarar 36mm x 50m',18,50,10],  ['Cinta Enmascarar 48mm x 50m',22,40,8],
    ['Cinta Azul 24mm x 50m',19,45,8],         ['Cinta Azul 48mm x 50m',28,32,6],
    ['Bandeja Rodillo Grande',28,22,4],         ['Bandeja Rodillo Pequeña',18,28,5],
    ['Marco Rodillo 9"',22,22,4],               ['Marco Rodillo 7"',18,25,5],
    ['Marco Rodillo 4"',14,28,6],
    ['Pintura Tráfico Blanca 1L',88,15,3],      ['Pintura Tráfico Amarilla 1L',88,12,3],
    ['Pintura Tráfico Roja 1L',88,10,2],        ['Pintura Tráfico Azul 1L',88,10,2],
    ['Pintura Pizarrón Negro 500ml',55,14,3],   ['Pintura Pizarrón Verde 500ml',55,12,3],
    ['Pintura Texturizada Blanca 4L',188,10,2], ['Pintura Texturizada Gris 4L',188,8,2],
    ['Pintura Texturizada Crema 4L',188,8,2],
    ['Pintura Epóxica Gris 1L',248,8,2],        ['Pintura Epóxica Negro 1L',248,7,2],
    ['Pintura Vinílica Blanca 4L',138,12,3],    ['Pintura Vinílica Crema 4L',138,10,2],
    ['Pintura Caucho Blanca 4L',158,10,2],
    ['Removedor Pintura 1L',65,15,3],           ['Removedor Pintura 4L',215,8,2],
    ['Fijador de Polvo 1L',48,15,3],            ['Fijador de Polvo 4L',162,8,2],
    ['Diluyente Universal 1L',25,35,7],         ['Diluyente Universal 4L',85,18,4],
    ['Brocha Esponja 2"',8,45,9],               ['Brocha Esponja 4"',12,38,8],
    ['Trapo para Pintor (pack 5)',22,28,6],      ['Plástico Protector 2x5m',18,22,5],
    ['Plástico Protector 4x5m',32,16,3],
    ['Guantes Látex Pintor (par)',12,45,9],      ['Mascarilla para Pintura',8,55,11],
    ['Gafas Protectoras Pintor',18,22,4],
    ['Imprimante Interior 4L',145,10,2],         ['Imprimante Exterior 4L',162,8,2],
    ['Promotor de Adherencia 1L',78,12,3],
    ['Pintura Fluo Roja 1/4L',45,14,3],         ['Pintura Fluo Verde 1/4L',45,12,3],
    ['Pintura Fluo Amarilla 1/4L',45,14,3],
    ['Lija en Rollo #80 5m',35,16,3],           ['Lija en Rollo #120 5m',35,14,3],
    ['Lija en Rollo #220 5m',38,12,3],
    ['Stucco Interior 1kg',38,20,4],             ['Stucco Interior 4kg',125,10,2],
    ['Estuco Veneciano 500g',65,12,3],
    ['Pintura de Piso Gris 1L',92,14,3],        ['Pintura de Piso Gris 4L',298,8,2],
    ['Pintura de Piso Roja 1L',92,12,3],
    ['Pintura Techo Blanca 4L',145,10,2],        ['Pintura Techo Gris 4L',148,8,2],
    ['Pintura Metálica Gris 1L',112,12,3],       ['Pintura Metálica Negro 1L',112,10,2],
    ['Pintura Aluminio Alta Temp 1L',128,10,2],
    ['Sellador de Grietas 300ml',45,18,4],       ['Sellador de Grietas 600ml',78,12,3],
    ['Vinimastic Blanco 4L',165,8,2],            ['Vinimastic Gris 4L',165,7,2],
    ['Diluyente Epóxico 1L',68,12,3],
    ['Rodillo de Espuma 4"',12,28,6],            ['Pistola para Calafatear',58,15,3],
  ];
  accs.forEach(function(a) { add(a[0], a[1], a[2], a[3]); });

  return rows.slice(0, 250);
}


// ── FIJACIÓN (250 productos) ──────────────────────────────────────────────────

function generateFijacion_() {
  var rows = [];
  var seq  = 20000;

  function add(nombre, precio, stock, min) {
    var bc = '7502' + String(seq++).padStart(9, '0');
    rows.push([bc, nombre, 'Fijación', stock, precio, '', min || Math.max(5, Math.round(stock * 0.2))]);
  }

  // Tornillo Madera Phillips — 3 diámetros × 6 longitudes = 18
  ['#6','#8','#10'].forEach(function(d) {
    var p = d==='#6'?6:d==='#8'?8:12;
    ['3/4"','1"','1.5"','2"','2.5"','3"'].forEach(function(l) {
      add('Tornillo Madera Phillips '+d+' '+l+' (caja 100pz)', p*8, 50, 10);
    });
  });

  // Tornillo Autoperforante — 8 tamaños = 8
  ['#8x1/2"','#8x3/4"','#8x1"','#8x1.5"','#10x1"','#10x1.5"','#10x2"','#12x2"'].forEach(function(s) {
    add('Tornillo Autoperforante '+s+' (caja 100pz)', 52, 45, 9);
  });

  // Tornillo Máquina — 4 diámetros × 5 longitudes = 20
  var tmPrecios = {M4:4,M5:5,M6:7,M8:10};
  ['M4','M5','M6','M8'].forEach(function(d) {
    ['20mm','25mm','30mm','40mm','50mm'].forEach(function(l) {
      add('Tornillo Máquina '+d+'x'+l, tmPrecios[d], 75, 15);
    });
  });

  // Perno Hexagonal — 4 diámetros × 5 longitudes = 20
  var pbPrecios = {M6:8,M8:12,M10:19,M12:28};
  ['M6','M8','M10','M12'].forEach(function(d) {
    ['40mm','50mm','60mm','80mm','100mm'].forEach(function(l) {
      add('Perno Hexagonal '+d+'x'+l, pbPrecios[d], 55, 10);
    });
  });

  // Tuercas — 3 tipos × 6 tamaños = 18
  ['Hexagonal','Mariposa','Autoblocante'].forEach(function(t) {
    ['M4','M5','M6','M8','M10','M12'].forEach(function(m) {
      var p = m==='M4'?3:m==='M5'?3:m==='M6'?4:m==='M8'?7:m==='M10'?10:14;
      add('Tuerca '+t+' '+m, p, 100, 20);
    });
  });

  // Arandelas — 2 tipos × 6 tamaños = 12
  ['Plana','Presión'].forEach(function(t) {
    ['M4','M5','M6','M8','M10','M12'].forEach(function(m) {
      add('Arandela '+t+' '+m, 2, 120, 25);
    });
  });

  // Clavos — 3 tipos × 7 tamaños = 21
  ['Liso','Galvanizado','Ardox'].forEach(function(t) {
    ['1"','1.5"','2"','2.5"','3"','3.5"','4"'].forEach(function(l) {
      add('Clavo '+t+' '+l+' (1 kg)', 38, 42, 8);
    });
  });

  // Taquetes Plástico — 5 tamaños = 5
  ['6mm','8mm','10mm','12mm','14mm'].forEach(function(s) {
    add('Taquete Plástico '+s+' (pack 25)', 18, 60, 12);
  });

  // Taquetes Metálico — 4 tamaños = 4
  ['M6','M8','M10','M12'].forEach(function(s) {
    add('Taquete Metálico '+s, 14, 45, 9);
  });

  // Remaches — 3 materiales × 4 tamaños = 12
  ['Aluminio','Acero','Inox'].forEach(function(m) {
    ['3/32"','1/8"','5/32"','3/16"'].forEach(function(s) {
      add('Remache '+m+' '+s+' (pack 50)', 24, 40, 8);
    });
  });

  // Abrazaderas — 2 tipos × 5 tamaños = 10
  ['Simple','con Tornillo'].forEach(function(t) {
    ['1/2"','3/4"','1"','1.5"','2"'].forEach(function(s) {
      add('Abrazadera '+t+' '+s, 16, 35, 7);
    });
  });

  // Espárragos — 3 diámetros × 4 longitudes = 12
  var espPrecios = {M6:16,M8:24,M10:38};
  ['M6','M8','M10'].forEach(function(d) {
    ['100mm','120mm','150mm','200mm'].forEach(function(l) {
      add('Espárrago '+d+'x'+l, espPrecios[d], 28, 6);
    });
  });

  // Varilla Roscada — 4 diámetros × 2 longitudes = 8
  var vrPrecios = {M6:19,M8:29,M10:45,M12:62};
  ['M6','M8','M10','M12'].forEach(function(d) {
    ['0.5m','1m'].forEach(function(l) {
      add('Varilla Roscada '+d+'x'+l, vrPrecios[d], 22, 4);
    });
  });

  // Bisagras — 3 tipos × 4 tamaños = 12
  ['Puerta','Ventana','Mueble'].forEach(function(t) {
    ['2"','3"','4"','5"'].forEach(function(s) {
      var p = s==='2"'?24:s==='3"'?36:s==='4"'?55:72;
      add('Bisagra '+t+' '+s, p, 28, 6);
    });
  });

  // Candados — 2 tipos × 3 tamaños = 6
  ['Arco Acero','Combinación'].forEach(function(t) {
    var precios = {'40mm':88,'50mm':125,'60mm':168};
    ['40mm','50mm','60mm'].forEach(function(s) {
      add('Candado '+t+' '+s, precios[s], 16, 3);
    });
  });

  // Soportes de estante — 4 tamaños = 4
  ['15cm','20cm','25cm','30cm'].forEach(function(s) {
    add('Soporte de Estante '+s, 19, 35, 7);
  });

  // Accesorios sueltos — completan hasta 250
  var accs = [
    ['Tornillo Cubierta 4x50mm (pk50)',58,22,4],  ['Tornillo Cubierta 5x50mm (pk50)',62,20,4],
    ['Tornillo Cubierta 5x70mm (pk50)',68,18,4],
    ['Tornillo Estructural 5/16"x3"',12,45,9],    ['Tornillo Estructural 3/8"x3"',15,40,8],
    ['Tornillo Estructural 3/8"x4"',18,35,7],
    ['Tornillo Anclaje M10 (pk10)',98,16,3],       ['Tornillo Anclaje M12 (pk10)',128,12,3],
    ['Resina de Anclaje 300ml',185,12,3],           ['Resina de Anclaje 600ml',328,7,2],
    ['Gancho Colgar Pequeño',8,55,11],              ['Gancho Colgar Mediano',12,45,9],
    ['Gancho Colgar Grande',18,35,7],
    ['Colgador de Cuadro (pk4)',22,28,6],
    ['Alambre de Amarre 1kg',36,28,6],              ['Alambre de Amarre 3kg',98,16,3],
    ['Clavija Madera 6mm (pk50)',28,22,5],          ['Clavija Madera 8mm (pk50)',34,20,4],
    ['Clavija Madera 10mm (pk50)',40,16,4],
    ['Cerrojo Puerta Pequeño',48,22,4],             ['Cerrojo Puerta Grande',68,16,3],
    ['Pestillo de Puerta',34,28,6],                 ['Pasador de Puerta 4"',29,22,5],
    ['Pasador de Puerta 6"',36,20,4],
    ['Freno de Puerta',40,16,3],                    ['Pivote de Piso',55,14,3],
    ['Tope de Puerta Pared',24,22,5],               ['Tope de Puerta Piso',19,28,6],
    ['Ángulo Acero 30x30mm x1m',46,16,3],           ['Ángulo Acero 40x40mm x1m',64,14,3],
    ['Ángulo Acero 50x50mm x1m',88,10,2],
    ['Placa Refuerzo T 100mm',29,16,3],             ['Placa Refuerzo L 100mm',26,20,4],
    ['Conector de Vigueta',34,16,3],
    ['Cinta Acero Perforada 25mm x1m',24,22,4],    ['Cinta Acero Perforada 30mm x1m',29,20,4],
    ['Riel para Estante 1m',68,16,3],               ['Riel para Estante 2m',118,10,2],
    ['Varilla Lisa 3/8" x1m',44,14,3],              ['Varilla Lisa 1/2" x1m',60,12,3],
    ['Dado Hexagonal M6',9,35,7],                   ['Dado Hexagonal M8',11,30,6],
    ['Dado Hexagonal M10',13,28,6],
    ['Tornillo Tirafondo 1/4"x2"',8,55,11],        ['Tornillo Tirafondo 1/4"x3"',10,50,10],
    ['Tornillo Tirafondo 5/16"x2.5"',11,45,9],
    ['Pin de Seguridad 2"',6,55,11],                ['Pin de Seguridad 3"',7,50,10],
    ['Pin de Seguridad 4"',9,45,9],
    ['Grampa Acero 1/2" (pk50)',28,35,7],            ['Grampa Acero 3/4" (pk50)',32,30,6],
    ['Grampa Acero 1" (pk50)',36,25,5],
    ['Taquete Mariposa M4',6,45,9],                 ['Taquete Mariposa M6',8,40,8],
    ['Taquete Mariposa M8',11,35,7],
    ['Perno Carrocero M8x50mm',14,35,7],            ['Perno Carrocero M10x50mm',20,28,6],
    ['Perno Ojo M8',18,22,5],                        ['Perno Ojo M10',25,18,4],
    ['Tornillo de Impacto M8x60mm',22,20,4],
    ['Clavo para Concreto 2"',5,65,13],             ['Clavo para Concreto 3"',6,55,11],
    ['Tornillo Drywall 6x25mm (pk100)',38,40,8],    ['Tornillo Drywall 6x38mm (pk100)',42,35,7],
    ['Tornillo Drywall 6x51mm (pk100)',48,30,6],
    ['Inserto Roscado M6 (pk10)',38,20,4],           ['Inserto Roscado M8 (pk10)',45,16,3],
    ['Arandela Especial M8',5,60,12],
  ];
  accs.forEach(function(a) { add(a[0], a[1], a[2], a[3]); });

  return rows.slice(0, 250);
}
