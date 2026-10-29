# Stylized forest trees, bushes and clouds for Birthday web 1 (original models, made in Blender).
# Run: blender -b --factory-startup --python stylized_nature.py -- <out.glb> [preview.png]
import bpy, bmesh, sys, math, random
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
MATS = {}

def mat(name, rgb, rough=0.8):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    MATS[name] = m
    return m

PINE = mat("M_pine", (0.07, 0.22, 0.2))
PINE2 = mat("M_pine_dark", (0.05, 0.16, 0.17))
LEAVES = mat("M_foliage", (0.2, 0.42, 0.17))
LEAVES2 = mat("M_foliage_light", (0.32, 0.52, 0.2))
BARK = mat("M_bark", (0.33, 0.21, 0.13))
BUSH = mat("M_bush", (0.16, 0.36, 0.16))
FLOWER_PINK = mat("M_flower_pink", (0.95, 0.5, 0.65))
FLOWER_WHITE = mat("M_flower_white", (0.98, 0.95, 0.9))
CLOUD = mat("M_cloud", (1, 1, 1), 1.0)

def smooth(ob):
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def apply_all(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

def join(objs, name):
    for o in objs: apply_all(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object; ob.name = name; ob.data.name = name
    return ob

def blob(loc, r, material, seed, rough=0.22, subdiv=3):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=subdiv, location=loc)
    ob = bpy.context.active_object
    ob.data.materials.append(material)
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for v in ob.data.vertices:
        n = noise.noise(v.co * (1.6 / r) + off)
        v.co += v.normal * n * r * rough
    # flatten the underside a little: stylised canopy clumps
    for v in ob.data.vertices:   # (mesh coordinates are local to the blob)
        if v.co.z < -r * 0.4: v.co.z = -r * 0.4 - (-r * 0.4 - v.co.z) * 0.35
    return smooth(ob)

def trunk(height, r0, r1, material, lean=(0, 0), seg=10):
    bm = bmesh.new()
    rings = []
    N = 8
    for i in range(N + 1):
        t = i / N
        r = r0 + (r1 - r0) * t
        cx, cy = lean[0] * t * t * height, lean[1] * t * t * height
        ring = [bm.verts.new((cx + math.cos(a) * r, cy + math.sin(a) * r, t * height)) for a in [2 * math.pi * k / seg for k in range(seg)]]
        rings.append(ring)
    for a, b in zip(rings[:-1], rings[1:]):
        for k in range(seg): bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    me = bpy.data.meshes.new("trunk"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("trunk", me); scene.collection.objects.link(ob)
    ob.data.materials.append(material)
    return smooth(ob)

objects = {}

def pine(name, seed, tiers=6, height=8.0, material=PINE):
    random.seed(seed)
    parts = [trunk(height * 0.3, 0.18, 0.12, BARK)]
    base = height * 0.18
    for i in range(tiers):
        t = i / tiers
        r = (1 - t) * 1.9 + 0.35
        h = height * 0.3 * (1 - t * 0.35)
        z = base + t * (height - base - h * 0.5)
        bm = bmesh.new()
        seg = 18
        top = bm.verts.new((0, 0, z + h))
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg + random.random() * 0.1
            rr = r * (1.0 if k % 2 == 0 else 0.78) * random.uniform(0.92, 1.05)
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z - (0.18 if k % 2 == 0 else 0.0) * r)))
        inner = [bm.verts.new((math.cos(2 * math.pi * k / seg) * r * 0.5, math.sin(2 * math.pi * k / seg) * r * 0.5, z + h * 0.08)) for k in range(seg)]
        for k in range(seg):
            bm.faces.new((ring[k], ring[(k + 1) % seg], top))
            bm.faces.new((inner[(k + 1) % seg], inner[k], ring[k], ring[(k + 1) % seg]))
        me = bpy.data.meshes.new("tier"); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new("tier", me); scene.collection.objects.link(ob)
        ob.data.materials.append(material)
        parts.append(ob)
    objects[name] = join(parts, name)

def broadleaf(name, seed, height=6.5, material=LEAVES, n=8):
    random.seed(seed)
    lean = (random.uniform(-0.08, 0.08), random.uniform(-0.08, 0.08))
    parts = [trunk(height * 0.55, 0.28, 0.14, BARK, lean)]
    cx, cy, cz = lean[0] * height * 0.55, lean[1] * height * 0.55, height * 0.62
    for i in range(n):
        a = random.random() * math.tau
        rr = random.uniform(0.3, 1.3)
        loc = (cx + math.cos(a) * rr, cy + math.sin(a) * rr, cz + random.uniform(-0.4, 1.2))
        parts.append(blob(loc, random.uniform(1.0, 1.55), material if random.random() < 0.7 else LEAVES2, seed * 10 + i))
    objects[name] = join(parts, name)

def bush(name, seed, n=5):
    random.seed(seed)
    parts = []
    for i in range(n):
        a = random.random() * math.tau; rr = random.uniform(0, 0.55)
        r = random.uniform(0.38, 0.62)
        parts.append(blob((math.cos(a) * rr, math.sin(a) * rr, r * 0.7), r, BUSH, seed * 5 + i, 0.18, 2))
    # little flowers dotted over the surface
    flowers = []
    for i in range(26):
        a = random.random() * math.tau; e = random.uniform(0.15, 1.1)
        p = Vector((math.cos(a) * math.cos(e) * 0.75, math.sin(a) * math.cos(e) * 0.75, 0.35 + math.sin(e) * 0.65))
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.055, subdivisions=1, location=p)
        f = bpy.context.active_object
        f.data.materials.append(FLOWER_PINK if random.random() < 0.75 else FLOWER_WHITE)
        flowers.append(f)
    objects[name] = join(parts + flowers, name)

def cloud(name, seed, n=11, width=10.0):
    random.seed(seed)
    mb = bpy.data.metaballs.new(name + "_mb")
    mb.resolution = 0.35; mb.render_resolution = 0.35
    for i in range(n):
        e = mb.elements.new()
        t = i / (n - 1)
        x = (t - 0.5) * width * random.uniform(0.85, 1.0)
        r = max((1 - abs(t - 0.5) * 1.2) * width * 0.17, width * 0.11) + random.uniform(0, width * 0.04)
        e.co = (x, random.uniform(-0.3, 0.3), r * 0.3 + random.uniform(0, 0.3))
        e.radius = r
    for i in range(n // 2):
        e = mb.elements.new()
        e.co = (random.uniform(-width * 0.25, width * 0.25), random.uniform(-0.3, 0.3), width * random.uniform(0.1, 0.16))
        e.radius = width * random.uniform(0.12, 0.17)
    ob = bpy.data.objects.new(name, mb); scene.collection.objects.link(ob)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object
    ob.name = name
    # flat underside, like real cumulus
    for v in ob.data.vertices:
        if v.co.z < 0: v.co.z *= 0.25
    dec = ob.modifiers.new("dec", 'DECIMATE'); dec.ratio = 0.6
    apply_all(ob)
    ob.data.materials.clear(); ob.data.materials.append(CLOUD)
    smooth(ob)
    objects[name] = ob

pine("pine_a", 1); pine("pine_b", 2, tiers=7, height=10.0, material=PINE2); pine("pine_c", 3, tiers=5, height=6.5)
broadleaf("broadleaf_a", 4); broadleaf("broadleaf_b", 5, height=7.5, n=10); broadleaf("broadleaf_c", 6, height=5.0, n=6)
bush("bush_a", 7); bush("bush_b", 8, n=4)
cloud("cloud_a", 9); cloud("cloud_b", 10, n=9, width=8.0); cloud("cloud_c", 11, n=14, width=14.0); cloud("cloud_d", 12, n=7, width=6.0)

x = 0
for name, ob in objects.items():
    ob.location = (x, 0, 0)
    x += max(ob.dimensions.x, 2.0) + 1.0
    print("OBJ", name, "dims", tuple(round(d, 2) for d in ob.dimensions), "tris", sum(len(p.vertices) - 2 for p in ob.data.polygons))

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT')
print("exported", OUT)

if PREVIEW:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1800, 520
    world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.35, 0.4, 0.65, 1)
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", 'SUN')); scene.collection.objects.link(sun)
    sun.data.energy = 3; sun.rotation_euler = (0.9, 0.3, 0.8)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = x * 1.0
    cam.location = (x / 2 - 1, -40, 6); cam.rotation_euler = (math.radians(88), 0, 0)
    scene.camera = cam
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    print("preview", PREVIEW)
