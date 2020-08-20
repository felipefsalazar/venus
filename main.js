
// Scene
var container, camera, scene, exporter, renderer, user_options, orbit_ctrl, trfm_ctrl;
var mesh = null;

// Subdivision surface
var MIN_SUBD_LEVEL = 0;
var MAX_SUBD_LEVEL = 4;
var subd_level = 2;
var smooth_mesh;
var smooth_verts_undeformed = [];
var model_index = 0;
var model_scale;

// FFD: control points of a lattice
var ffd = new FFD();
var MIN_SPAN_COUNT = 1;
var MAX_SPAN_COUNT = 8;
var span_counts = [2, 2, 2];
var ctrl_pt_geom = new THREE.SphereGeometry(2);
var ctrl_pt_material = new THREE.MeshLambertMaterial({ color: 0x4d4dff });
var ctrl_pt_meshes = [];
var ctrl_pt_mesh_selected = null;
var lattice_lines = [];
var lattice_line_material = new THREE.LineBasicMaterial({ color: 0x4d4dff });

// Evaluated points
var eval_pt_spans = new THREE.Vector3(16, 16, 16);
var eval_pt_counts = new THREE.Vector3(
  eval_pt_spans.x + 1,
  eval_pt_spans.y + 1,
  eval_pt_spans.z + 1);
  var eval_pts_geom = new THREE.Geometry();
  var eval_pts_mesh;
  var show_eval_pts_checked = false;

  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();

  // Create new object by parameters
  var createSomething = function(klass, args) {
    var F = function(klass, args) {
      return klass.apply(this, args);
    };
    F.prototype = klass.prototype;
    return new F(klass, args);
  };

  // Models
  var modelLibrary = [];

  // Exporter .STL
  var  exporter = new THREE.STLExporter();

  //// ***************** MEU MODELO **********************

  var loader = new THREE.STLLoader();
  loader.load('model/venus3.stl', function(geometry) {
    geometry = new THREE.Geometry().fromBufferGeometry(geometry);
    console.log(geometry);
    modelLibrary.push({ type: 'CustomType', args: [], meshScale: 2 });
    THREE.CustomType = function() {
      return geometry.clone();
    };
    init();
    updateUserOptions();
  });

  //// ***************** MEU MODELO **********************

  // start scene

  function init() {
    container = document.createElement('div');
    document.body.appendChild(container);

    // User options
    user_options = document.createElement('div');
    user_options.style.position = 'absolute';
    user_options.style.top = '0px';
    user_options.style.left = '10px';
    user_options.style.width = '30%';
    user_options.style.textAlign = 'left';
    container.appendChild(user_options);



    // Camera
    camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 1000);

    camera.position.x = 498;
    camera.position.y = 560;
    camera.position.z = 303;

    scene = new THREE.Scene();

    //GRID CINZA NA TELA
    //scene.add(new THREE.GridHelper(100, 100));

    // Light
    var light = new THREE.PointLight(0xffffff, 1.5);
    light.position.set(1000, 1000, 2000);
    scene.add(light);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });

    //cor do background
    renderer.setClearColor(0xf0f0f0);

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
    renderer.domElement.addEventListener('mousedown', onDocumentMouseDown, false);
    document.body.appendChild( renderer.domElement );

    // Orbit controls
    orbit_ctrl = new THREE.OrbitControls(camera, renderer.domElement);
    orbit_ctrl.damping = 0.5;
    orbit_ctrl.addEventListener('change', render);

    // Transform control (a triad)
    trfm_ctrl = new THREE.TransformControls(camera, renderer.domElement);
    trfm_ctrl.addEventListener('change', render);
    scene.add(trfm_ctrl);

    trfm_ctrl.addEventListener('objectChange', function(e) {
      updateLattice();
      deform();
    });

    window.addEventListener('resize', onWindowResize, false);

    createEvalPtsMesh();
    addModel();
    animate();

  }

function buttonExport () {
  var buttonExportASCII = document.getElementById( 'exportASCII' );
  buttonExportASCII.addEventListener( 'click', exportASCII );
    }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onDocumentMouseMove(event) {
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var intersects = raycaster.intersectObjects(ctrl_pt_meshes);
    // If the mouse cursor is hovering over a new control point...
    if (intersects.length > 0 && ctrl_pt_mesh_selected != intersects[0].object) {
      // Temporarily change the cursor shape to a fingering cursor.
      container.style.cursor = 'pointer';
    }
    else {
      container.style.cursor = 'auto';
    }
  }

  function onDocumentMouseDown(event) {
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var intersects = raycaster.intersectObjects(ctrl_pt_meshes);
    // If a new control point is selected...
    if (intersects.length > 0 && ctrl_pt_mesh_selected != intersects[0].object) {
      // Temporarily disable the orbit control. This prevents the user from
      // getting surprised or annoyed by the scene rotation as soon as a new
      // control point is selected.
      orbit_ctrl.enabled = false;
      // If a control point was selected before, detach it from the transform control.
      if (ctrl_pt_mesh_selected)
      trfm_ctrl.detach(trfm_ctrl.object);
      // Remember the new selection to avoid reselecting the same one.
      ctrl_pt_mesh_selected = intersects[0].object;
      // Attach the newly selected control point to the transform control.
      trfm_ctrl.attach(ctrl_pt_mesh_selected);
    }
    else {
      // Enable the orbit control so that the user can pan/rotate/zoom.
      orbit_ctrl.enabled = true;
    }
      // console.log (camera.position.x, "x é.. ");
      // console.log (camera.position.y, "y é.. ");
      // console.log (camera.position.z, "z é.. ");
  }

  function animate() {
    requestAnimationFrame(animate);
    orbit_ctrl.update();
    //trfm_ctrl.update();
    render();
  }

  function render() {
    eval_pts_mesh.visible = show_eval_pts.checked;
    renderer.render(scene, camera);
  }

  function nextSubdivisionLevel(step) {
    var old_level = subd_level;

    // Cap the subdivision level to the bounds of [ MIN_SUBD_LEVEL, MAX_SUBD_LEVEL ].
    subd_level = Math.max(MIN_SUBD_LEVEL, Math.min(subd_level + step, MAX_SUBD_LEVEL));

    if (subd_level != old_level)
    addModel();
  }

  function updateUserOptions() {
    user_options.innerHTML =

    // Show/change the subdivision level.
    // ' (Subdivision level: <input type="button" onclick="nextSubdivisionLevel( -1 );" value="-" /> ' +
    // subd_level + ' <input type="button" onclick="nextSubdivisionLevel( 1 );" value="+" />' +
    // // Show the vertex count.
    // ' (Vertices: ' + orig_geom.vertices.length + '->' + smooth_geom.vertices.length +
    // // Show the face count.
    // ') (Faces: ' + orig_geom.faces.length + '->' + smooth_geom.faces.length + ')' +

    // ************* TEXTO LATERAL
    '<h1> Festival ECRÃ </h1> <h2><strong> VENUS DE FORÇAS </strong></h2> por <i>Lorenzo Papanti</i>  <h4>Aumente o número de pontos de controle do modelo:<br> (X: ' +
    '<input type="button" onclick="nextSpanCount( 0, -1 );" value="-" /> ' +
    span_counts[0] + ' <input type="button" onclick="nextSpanCount( 0, 1 );" value="+" />' +
    ') // (Y: <input type="button" onclick="nextSpanCount( 1, -1 );" value="-" /> ' +
    span_counts[1] + ' <input type="button" onclick="nextSpanCount( 1, 1 );" value="+" />' +
    ') // (Z: <input type="button" onclick="nextSpanCount( 2, -1 );" value="-" /> ' +
    span_counts[2] + ' <input type="button" onclick="nextSpanCount( 2, 1 );" value="+" />) </h4>'  +

    // Check box: "Show evaluated points (red dots) <br>
        ' <input type="checkbox" id="show_eval_pts" ' + (show_eval_pts_checked ? 'checked' : 'unchecked') +
        ' onchange="show_eval_pts_checked = !show_eval_pts_checked; deform();" />' +
        '<label for="show_eval_pts"> Mesh vermelha</label> <br> <br> <input type="button", style ="font-size: 1em" id="exportASCII" onclick="buttonExport();" value="Exportar para Impressão 3D (.STL)">'
  ;}

  function addModel() {
    if (smooth_mesh) {
      scene.remove(group);
      scene.remove(smooth_mesh);
    }

    if (ctrl_pt_mesh_selected)
    trfm_ctrl.detach(trfm_ctrl.object);

    var subd_modifier = new THREE.SubdivisionModifier(subd_level);
    var model = modelLibrary[model_index];
    orig_geom = createSomething(THREE[model.type], model.args);

    // Scale geometry.
    if (model.scale)
    orig_geom.scale(model.scale, model.scale, model.scale);

    // Cloning original geometry for debuging
    smooth_geom = orig_geom.clone();

    // Merge duplicate vertices.
    smooth_geom.mergeVertices();
    smooth_geom.computeFaceNormals();
    smooth_geom.computeVertexNormals();

    subd_modifier.modify(smooth_geom);

    updateUserOptions();

    var faceABCD = "abcd";
    var color, f, p, n, vertexIndex;

    for (i = 0; i < smooth_geom.faces.length; i++) {
      f = smooth_geom.faces[i];
      n = (f instanceof THREE.Face3) ? 3 : 4;

      for (var j = 0; j < n; j++) {
        vertexIndex = f[faceABCD.charAt(j)];

        p = smooth_geom.vertices[vertexIndex];

        color = new THREE.Color(0xffffff);
        color.setHSL((p.y) / 200 + 0.5, 1.0, 0.5);

        f.vertexColors[j] = color;
      }
    }

    group = new THREE.Group();
    scene.add(group);

    // Mesh for the original model
    var display_orig_mesh = false;
    if (display_orig_mesh) {
      var orig_material = new THREE.MeshBasicMaterial({ color: 0xfefefe, wireframe: true, opacity: 0.5 });
      var orig_mesh = new THREE.Mesh(orig_geom, orig_material);
      group.add(orig_mesh);
    }

    // Mesh for the smooth model
    var smooth_materials = [
      new THREE.MeshPhongMaterial({ color: 0xffffff, shading: THREE.FlatShading, vertexColors: THREE.VertexColors, shininess: 0 }),
      new THREE.MeshBasicMaterial({ color: 0x405040, wireframe: true, opacity: 0.8, transparent: true })
    ];
    smooth_mesh = THREE.SceneUtils.createMultiMaterialObject(smooth_geom, smooth_materials);

    model_scale = model.meshScale ? model.meshScale : 1;
    smooth_mesh.scale.x = model_scale;
    smooth_mesh.scale.y = model_scale;
    smooth_mesh.scale.z = model_scale;

    scene.add(smooth_mesh);

    group.scale.copy(smooth_mesh.scale);

    // Store the vert positions of the smooth model. Empty the storage first.
    smooth_verts_undeformed.length = 0;
    for (i = 0; i < smooth_geom.vertices.length; i++) {
      var copy_pt = new THREE.Vector3();
      copy_pt.copy(smooth_geom.vertices[i]);
      smooth_verts_undeformed.push(copy_pt);
    }

    rebuildFFD(false);
  }

  // direction: 0 for S, 1 for T, and 2 for U.
  function nextSpanCount(direction, step) {
    var old_count = span_counts[direction];

    // Cap the span count to the bounds of [ MIN_SPAN_COUNT, MAX_SPAN_COUNT ].
    span_counts[direction] = Math.max(MIN_SPAN_COUNT, Math.min(span_counts[direction] + step, MAX_SPAN_COUNT));

    if (span_counts[direction] != old_count) {
      rebuildFFD(true);
      // Update the span count displayed.
      updateUserOptions();
    }
  }

  function rebuildFFD(span_count_change_only) {
    removeCtrlPtMeshes();
    removeLatticeLines();

    var bbox;
    if (span_count_change_only) {
      bbox = ffd.getBoundingBox();
    }
    else {
      bbox = new THREE.Box3();
      // Compute the bounding box that encloses all vertices of the smooth model.
      bbox.setFromPoints(smooth_geom.vertices);
      // Scale the bounding box if necessary.
      if (model_scale != 1)
      bbox.set(bbox.min.multiplyScalar(model_scale), bbox.max.multiplyScalar(model_scale))
    }

    // Do not pass span_counts to ffd.
    var span_counts_copy = [span_counts[0], span_counts[1], span_counts[2]];

    // Rebuild the lattice with new control points.
    ffd.rebuildLattice(bbox, span_counts_copy);

    addCtrlPtMeshes();
    addLatticeLines();

    deform();
  }

  function removeCtrlPtMeshes() {
    for (var i = 0; i < ctrl_pt_meshes.length; i++)
    scene.remove(ctrl_pt_meshes[i]);
    ctrl_pt_meshes.length = 0;
  }

  function removeLatticeLines() {
    for (var i = 0; i < lattice_lines.length; i++)
    scene.remove(lattice_lines[i]);
    lattice_lines.length = 0;
  }

  function addCtrlPtMeshes() {
    for (var i = 0; i < ffd.getTotalCtrlPtCount() ; i++) {
      var ctrl_pt_mesh = new THREE.Mesh(ctrl_pt_geom, ctrl_pt_material);
      ctrl_pt_mesh.position.copy(ffd.getPosition(i));
      ctrl_pt_mesh.material.ambient = ctrl_pt_mesh.material.color;

      ctrl_pt_meshes.push(ctrl_pt_mesh);
      scene.add(ctrl_pt_mesh);
    }
  }

  function addLatticeLines() {
    // Lines in S direction.
    for (var i = 0; i < ffd.getCtrlPtCount(0) - 1; i++) {
      for (var j = 0; j < ffd.getCtrlPtCount(1) ; j++) {
        for (var k = 0; k < ffd.getCtrlPtCount(2) ; k++) {
          var geometry = new THREE.Geometry();
          geometry.vertices.push(ctrl_pt_meshes[ffd.getIndex(i, j, k)].position);
          geometry.vertices.push(ctrl_pt_meshes[ffd.getIndex(i + 1, j, k)].position);
          var line = new THREE.Line(geometry, lattice_line_material);

          lattice_lines.push(line);
          scene.add(line);
        }
      }
    }
    // Lines in T direction.
    for (var i = 0; i < ffd.getCtrlPtCount(0) ; i++) {
      for (var j = 0; j < ffd.getCtrlPtCount(1) - 1; j++) {
        for (var k = 0; k < ffd.getCtrlPtCount(2) ; k++) {
          var geometry = new THREE.Geometry();
          geometry.vertices.push(ctrl_pt_meshes[ffd.getIndex(i, j, k)].position);
          geometry.vertices.push(ctrl_pt_meshes[ffd.getIndex(i, j + 1, k)].position);
          var line = new THREE.Line(geometry, lattice_line_material);

          lattice_lines.push(line);
          scene.add(line);
        }
      }
    }
    // Lines in U direction.
    for (var i = 0; i < ffd.getCtrlPtCount(0) ; i++) {
      for (var j = 0; j < ffd.getCtrlPtCount(1) ; j++) {
        for (var k = 0; k < ffd.getCtrlPtCount(2) - 1; k++) {
          var geometry = new THREE.Geometry();
          geometry.vertices.push(ctrl_pt_meshes[ffd.getIndex(i, j, k)].position);
          geometry.vertices.push(ctrl_pt_meshes[ffd.getIndex(i, j, k + 1)].position);
          var line = new THREE.Line(geometry, lattice_line_material);

          lattice_lines.push(line);
          scene.add(line);
        }
      }
    }
  }

  function createEvalPtsMesh() {
    var total_eval_pts_count = eval_pt_counts.x * eval_pt_counts.y * eval_pt_counts.z;
    for (var i = 0; i < total_eval_pts_count; i++)
    eval_pts_geom.vertices.push(new THREE.Vector3());
    // Red dot
    eval_pts_mesh = new THREE.Points(eval_pts_geom.clone(), new THREE.PointsMaterial({ color: 0xff0000, size: 2 }));
    scene.add(eval_pts_mesh);
  }

  function updateLattice() {
    // Update the positions of all control point in the FFD object.
    for (var i = 0; i < ffd.getTotalCtrlPtCount() ; i++)
    ffd.setPosition(i, ctrl_pt_meshes[i].position);

    // Update the positions of all lines of the lattice.
    var line_index = 0;
    // Lines in S direction.
    for (var i = 0; i < ffd.getCtrlPtCount(0) - 1; i++) {
      for (var j = 0; j < ffd.getCtrlPtCount(1) ; j++) {
        for (var k = 0; k < ffd.getCtrlPtCount(2) ; k++) {
          var line = lattice_lines[line_index++];
          line.geometry.vertices[0] = ctrl_pt_meshes[ffd.getIndex(i, j, k)].position;
          line.geometry.vertices[1] = ctrl_pt_meshes[ffd.getIndex(i + 1, j, k)].position;
          line.geometry.verticesNeedUpdate = true;
        }
      }
    }
    // Lines in T direction.
    for (var i = 0; i < ffd.getCtrlPtCount(0) ; i++) {
      for (var j = 0; j < ffd.getCtrlPtCount(1) - 1; j++) {
        for (var k = 0; k < ffd.getCtrlPtCount(2) ; k++) {
          var line = lattice_lines[line_index++];
          line.geometry.vertices[0] = ctrl_pt_meshes[ffd.getIndex(i, j, k)].position;
          line.geometry.vertices[1] = ctrl_pt_meshes[ffd.getIndex(i, j + 1, k)].position;
          line.geometry.verticesNeedUpdate = true;
        }
      }
    }
    // Lines in U direction.
    for (var i = 0; i < ffd.getCtrlPtCount(0) ; i++) {
      for (var j = 0; j < ffd.getCtrlPtCount(1) ; j++) {
        for (var k = 0; k < ffd.getCtrlPtCount(2) - 1; k++) {
          var line = lattice_lines[line_index++];
          line.geometry.vertices[0] = ctrl_pt_meshes[ffd.getIndex(i, j, k)].position;
          line.geometry.vertices[1] = ctrl_pt_meshes[ffd.getIndex(i, j, k + 1)].position;
          line.geometry.verticesNeedUpdate = true;
        }
      }
    }
  }

  function deform() {
    // Update the model vertices.
    for (i = 0; i < smooth_geom.vertices.length; i++) {
      var eval_pt = ffd.evalWorld(smooth_verts_undeformed[i]);
      if (eval_pt.equals(smooth_geom.vertices[i]))
      continue;
      smooth_geom.vertices[i].copy(eval_pt);
    }
    smooth_geom.verticesNeedUpdate = true;

    // Update the mesh for evaluated points.
    if (show_eval_pts.checked) {
      var multipliers = new THREE.Vector3(
        1 / eval_pt_spans.x,
        1 / eval_pt_spans.y,
        1 / eval_pt_spans.z);
        var mesh_vert;
        var mesh_vert_counter = 0;
        for (var i = 0; i < eval_pt_counts.x; i++) {
          var s = i * multipliers.x;
          for (var j = 0; j < eval_pt_counts.y; j++) {
            var t = j * multipliers.y;
            for (var k = 0; k < eval_pt_counts.z; k++) {
              var u = k * multipliers.z;
              var eval_pt = ffd.evalTrivariate(s, t, u);

              mesh_vert = eval_pts_mesh.geometry.vertices[mesh_vert_counter++];

              if (eval_pt.equals(mesh_vert))
              continue;
              mesh_vert.copy(eval_pt);
            }
          }
        }
        eval_pts_mesh.geometry.verticesNeedUpdate = true;
      }
    }

/// ********* EXPORTANDO ***********

    function exportASCII() {

      //EXPORTAR A MESH ATUALIZADA EM .STL
        var result = exporter.parse( smooth_mesh );
				saveString( result, 'venusExport.stl' );

			}
      var link = document.createElement( 'a' );
			link.style.display = 'none';
			document.body.appendChild( link );

			function save( blob, filename ) {

				link.href = URL.createObjectURL( blob );
				link.download = filename;
				link.click();

			}

			function saveString( text, filename ) {

				save( new Blob( [ text ], { type: 'text/plain' } ), filename );

			}

      /// ********* EXPORTANDO FIM ***********
