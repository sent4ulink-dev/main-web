# Thins Poly Haven's island_tree_02 (CC0, Rob Tuytel & Rico Cilliers) into a web-weight hero tree.
# Keeps a random subset of leaf cards (scaled up so the canopy stays full) and decimates wood.
# Run: blender -b --factory-startup --python tree_hero.py -- <src.gltf> <out.glb> <leaf_keep> <preview.png>
import bpy, bmesh, sys, random
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
KEEP = float(argv[2]) if len(argv) > 2 else 0.22
PREVIEW = argv[3] if len(argv) > 3 else None
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
tree = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = tree
tree.select_set(True)
print("dims (m):", tuple(round(d, 2) for d in tree.dimensions), "tris:", sum(len(p.vertices) - 2 for p in tree.data.polygons))

# Split per material so leaves, branches and trunk can be treated differently.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')

parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in parts:
    mat = o.data.materials[0].name if o.data.materials else "none"
    o.name = "tree_" + ("leaves" if "leaves" in mat else "branches" if "branches" in mat else "trunk")
    print(o.name, "tris:", sum(len(p.vertices) - 2 for p in o.data.polygons))

def thin_leaves(obj, keep, grow):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    seen, islands = set(), []
    for f in bm.faces:
        if f.index in seen: continue
        stack, isl = [f], []
        seen.add(f.index)
        while stack:
            cur = stack.pop(); isl.append(cur)
            for e in cur.edges:
                for nf in e.link_faces:
                    if nf.index not in seen:
                        seen.add(nf.index); stack.append(nf)
        islands.append(isl)
    print(f"{obj.name}: {len(islands)} leaf islands")
    kill = []
    for isl in islands:
        if random.random() > keep:
            kill.extend(isl)
        else:
            verts = {v for fc in isl for v in fc.verts}
            c = sum((v.co for v in verts), Vector()) / len(verts)
            s = grow * random.uniform(0.85, 1.15)
            for v in verts: v.co = c + (v.co - c) * s
    bmesh.ops.delete(bm, geom=list(set(kill)), context='FACES')
    bm.to_mesh(obj.data); bm.free()

for o in parts:
    if o.name.startswith("tree_leaves"):
        thin_leaves(o, KEEP, 1.0 / max(KEEP, 0.05) ** 0.42)
    else:
        m = o.modifiers.new("dec", 'DECIMATE'); m.ratio = 0.15 if o.name.startswith("tree_branches") else 0.3
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    print(o.name, "-> tris:", sum(len(p.vertices) - 2 for p in o.data.polygons))

for o in parts: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
                          export_image_format='WEBP', export_image_quality=85, export_materials='EXPORT')
print("exported", OUT)

if PREVIEW:
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 900, 900
    world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.7, 0.95, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.2
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = 4; sun.rotation_euler = (0.9, 0.2, 0.6)
    size = max(max(o.dimensions) for o in parts)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam)
    cam.location = (size * 1.6, -size * 1.6, size * 0.55)
    tgt = bpy.data.objects.new("tgt", None); sc.collection.objects.link(tgt); tgt.location = (0, 0, size * 0.35)
    c = cam.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    sc.camera = cam
    sc.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    print("preview", PREVIEW)
