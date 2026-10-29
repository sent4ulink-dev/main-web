# Dev helper: render chosen props from an exported .glb, side by side.
# blender -b --factory-startup --python preview_one.py -- in.glb out.png name1 name2 …
import bpy, sys, math
a = sys.argv[sys.argv.index("--") + 1:]
src, out, names = a[0], a[1], a[2:]
span = float(names[-1]) if names and names[-1].replace(".", "").isdigit() else 1.4
if names and names[-1].replace(".", "").isdigit(): names = names[:-1]
for o in list(bpy.context.scene.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=src)
roots = {o.name: o for o in bpy.context.scene.objects if o.parent is None}
keep = []
for o in list(bpy.context.scene.objects):
    r = o
    while r.parent: r = r.parent
    if r.name not in names: o.hide_render = True
x = 0.0
for n in names:
    r = roots[n]; r.location = (x, 0, 0); r.rotation_euler = (math.pi / 2, 0, 0); x += span
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.45, 0.4, 1)
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 3.5; sun.rotation_euler = (0.9, 0.2, 0.5)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = span * 1.08 * len(names)
cam.location = ((x - span) / 2, -40, 8.5 + span * 0.45); cam.rotation_euler = (math.radians(78), 0, 0)
sc.render.resolution_x, sc.render.resolution_y = 1400, 700
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
