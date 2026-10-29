# Stylized instant camera, crystal-ball stand and magic wand for Birthday web 1 (original models, made in Blender).
# Run: blender -b --factory-startup --python stylized_props.py -- <out.glb> [preview.png]
#
# Conventions (Blender, Z-up): every prop stands on z = 0 and faces -Y (glTF +Z after export).
#   instant_camera — Instax-style: the photo rises out of a slot on the TOP, parallel to the front.
#                    slot centre (Blender) = (0, SLOT_Y, H); lens centre = (LENS_X, -D/2 - 0.02, LENS_Z)
#   crystal_stand  — turned walnut stand with a gold band; the glass ball (made in three.js) sits at z = BALL_Z
#   magic_wand     — lies flat, centred on the origin
import bpy, bmesh, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

MATS = {}
def mat(name, rgb, rough=0.6, metal=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    MATS[name] = m
    return m

def prim(kind, name, material, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), **kw):
    fn = {"cube": bpy.ops.mesh.primitive_cube_add, "uv": bpy.ops.mesh.primitive_uv_sphere_add,
          "ico": bpy.ops.mesh.primitive_ico_sphere_add, "cyl": bpy.ops.mesh.primitive_cylinder_add,
          "torus": bpy.ops.mesh.primitive_torus_add}[kind]
    fn(location=loc, rotation=rot, **kw)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    if material: ob.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return ob

def bevel(ob, w=0.004, seg=3):
    m = ob.modifiers.new("bev", 'BEVEL'); m.width = w; m.segments = seg; m.limit_method = 'ANGLE'
    return ob

def smooth(ob, angle=40):
    for p in ob.data.polygons: p.use_smooth = True
    if hasattr(ob.data, "set_sharp_from_angle"): ob.data.set_sharp_from_angle(angle=math.radians(angle))
    return ob

def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

def join(objs, name):
    for o in objs: apply_mods(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name; ob.data.name = name
    return ob

def lathe(name, prof, material, seg=48):
    bm = bmesh.new(); rings = []
    for r, z in prof:
        rings.append([bm.verts.new((math.cos(2 * math.pi * i / seg) * r, math.sin(2 * math.pi * i / seg) * r, z)) for i in range(seg)])
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for i in range(seg): bm.faces.new((r0[i], r0[(i + 1) % seg], r1[(i + 1) % seg], r1[i]))
    bm.faces.new(rings[0][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    ob.data.materials.append(material)
    return smooth(ob, 50)

def parent_to(children, name):
    root = bpy.data.objects.new(name, None); scene.collection.objects.link(root)
    for c in children: c.parent = root
    return root

# ── palette (storybook pastels) ───────────────────────────
PINK = mat("M_cam_pink", (0.93, 0.62, 0.68), 0.55)
CREAM = mat("M_cam_cream", (0.97, 0.93, 0.86), 0.5)
BLACK = mat("M_cam_black", (0.07, 0.065, 0.08), 0.45)
GLASS = mat("M_cam_glass", (0.12, 0.16, 0.3), 0.1)
SHINE = mat("M_cam_shine", (0.85, 0.9, 1.0), 0.15)
SILVER = mat("M_cam_silver", (0.78, 0.78, 0.82), 0.3, 0.6)
FLASH = mat("M_cam_flash", (0.96, 0.96, 0.92), 0.25)
RAINBOW = [mat(f"M_rainbow_{i}", c, 0.5) for i, c in enumerate([(0.9, 0.25, 0.25), (0.98, 0.55, 0.2), (0.98, 0.83, 0.25), (0.35, 0.72, 0.4), (0.3, 0.55, 0.9)])]
WALNUT = mat("M_walnut", (0.33, 0.18, 0.1), 0.55)
GOLD = mat("M_gold", (0.95, 0.74, 0.32), 0.3, 0.9)
WAND = mat("M_wand", (0.08, 0.07, 0.09), 0.4)
WAND_TIP = mat("M_wand_tip", (0.97, 0.95, 0.9), 0.4)

# ── instant camera ────────────────────────────────────────
W, D, H = 0.14, 0.078, 0.118
SLOT_Y = 0.012
LENS_X, LENS_Z = -0.008, 0.052
parts = []
body = prim("cube", "cam_body", PINK, loc=(0, 0, H / 2 - 0.006), scale=(W / 2, D / 2, (H - 0.012) / 2))
bevel(body, 0.016, 5); smooth(body, 35); parts.append(body)
cap = prim("cube", "cam_cap", CREAM, loc=(0, 0, H - 0.012), scale=(W / 2 - 0.002, D / 2 - 0.002, 0.012))
bevel(cap, 0.01, 4); smooth(cap, 35); parts.append(cap)
# slot on top (dark slit the photo rises out of)
slot = prim("cube", "cam_slot", BLACK, loc=(0, SLOT_Y, H), scale=(0.05, 0.0028, 0.002))
parts.append(slot)
# lens: cream outer ring, black barrel, dark glass with a highlight
ring = prim("cyl", "lens_ring", CREAM, loc=(LENS_X, -D / 2 - 0.004, LENS_Z), rot=(math.pi / 2, 0, 0), radius=0.04, depth=0.012, vertices=48)
bevel(ring, 0.003, 3); smooth(ring); parts.append(ring)
barrel = prim("cyl", "lens_barrel", BLACK, loc=(LENS_X, -D / 2 - 0.013, LENS_Z), rot=(math.pi / 2, 0, 0), radius=0.03, depth=0.016, vertices=48)
bevel(barrel, 0.002, 2); smooth(barrel); parts.append(barrel)
trim = prim("torus", "lens_trim", SILVER, loc=(LENS_X, -D / 2 - 0.021, LENS_Z), rot=(math.pi / 2, 0, 0), major_radius=0.026, minor_radius=0.0018, major_segments=48, minor_segments=8)
smooth(trim); parts.append(trim)
glass = prim("uv", "lens_glass", GLASS, loc=(LENS_X, -D / 2 - 0.019, LENS_Z), scale=(1, 0.35, 1), radius=0.022, segments=32, ring_count=16)
smooth(glass); parts.append(glass)
shine = prim("uv", "lens_shine", SHINE, loc=(LENS_X - 0.008, -D / 2 - 0.0255, LENS_Z + 0.009), scale=(1, 0.4, 1), radius=0.0045, segments=12, ring_count=8)
smooth(shine); parts.append(shine)
# viewfinder (top left) and rainbow stripe (front left)
vf = prim("cube", "viewfinder", BLACK, loc=(-0.048, -D / 2 - 0.001, H - 0.026), scale=(0.008, 0.002, 0.007))
bevel(vf, 0.002, 2); parts.append(vf)
for i, m in enumerate(RAINBOW):
    s = prim("cube", f"stripe{i}", m, loc=(0.05, -D / 2 - 0.0012, 0.022 + i * 0.0068), scale=(0.012, 0.0012, 0.0034))
    parts.append(s)
# back: eyepiece, a little mode dial, the film-door seam and a heart sticker (seen over its shoulder)
eye = prim("cube", "eyepiece", BLACK, loc=(-0.048, D / 2 + 0.002, H - 0.026), scale=(0.011, 0.003, 0.008))
bevel(eye, 0.002, 2); parts.append(eye)
dial = prim("cyl", "dial", CREAM, loc=(0.045, D / 2 + 0.002, H - 0.03), rot=(math.pi / 2, 0, 0), radius=0.011, depth=0.004, vertices=24)
bevel(dial, 0.001, 2); smooth(dial); parts.append(dial)
seam = prim("cube", "seam", mat("M_cam_seam", (0.72, 0.45, 0.5), 0.6), loc=(0, D / 2 + 0.0006, 0.045), scale=(W / 2 - 0.016, 0.0008, 0.0012))
parts.append(seam)
heart = prim("cube", "sticker", RAINBOW[0], loc=(-0.035, D / 2 + 0.0008, 0.028), rot=(0, math.radians(45), 0), scale=(0.006, 0.0008, 0.006))
parts.append(heart)
for dx in (-0.0042, 0.0042):
    lobe = prim("cyl", "lobe", RAINBOW[0], loc=(-0.035 + dx, D / 2 + 0.0008, 0.0322), rot=(math.pi / 2, 0, 0), radius=0.0048, depth=0.0016, vertices=16)
    parts.append(lobe)
# feet
for x in (-0.05, 0.05):
    f = prim("cyl", "foot", BLACK, loc=(x, 0, 0.002), radius=0.007, depth=0.004, vertices=16)
    parts.append(f)
cam_body = join(parts, "instant_body")
# separate pieces the app animates
flash = prim("cube", "instant_flash", FLASH, loc=(0.042, -D / 2 - 0.0015, H - 0.03), scale=(0.019, 0.003, 0.011))
bevel(flash, 0.003, 3); apply_mods(flash); smooth(flash)
shutter = prim("cyl", "instant_shutter", SILVER, loc=(0.045, -0.012, H + 0.003), radius=0.0085, depth=0.007, vertices=24)
bevel(shutter, 0.002, 2); apply_mods(shutter); smooth(shutter)
parent_to([cam_body, flash, shutter], "instant_camera")
print("INSTANT dims W D H", W, D, H, "slot", (0, SLOT_Y, H), "lens", (LENS_X, -D / 2 - 0.02, LENS_Z))

# ── crystal ball stand ───────────────────────────────────
BALL_R = 0.05
prof = [(0.058, 0.0), (0.058, 0.008), (0.054, 0.013), (0.04, 0.02), (0.032, 0.03), (0.034, 0.036), (0.043, 0.041), (0.043, 0.047), (0.036, 0.05), (0.03, 0.052)]
stand = lathe("stand_wood", prof, WALNUT)
band = prim("torus", "stand_band", GOLD, loc=(0, 0, 0.044), major_radius=0.0435, minor_radius=0.0028, major_segments=48, minor_segments=8)
smooth(band)
beads = []
for i in range(3):
    a = i * math.tau / 3 + 0.5
    b = prim("ico", "bead", GOLD, loc=(math.cos(a) * 0.05, math.sin(a) * 0.05, 0.0105), radius=0.0055, subdivisions=2)
    smooth(b); beads.append(b)
crystal = join([stand, band, *beads], "crystal_stand")
BALL_Z = 0.05 + BALL_R * 0.82
print("CRYSTAL ball centre z", round(BALL_Z, 4), "radius", BALL_R)

# ── magic wand ───────────────────────────────────────────
w1 = prim("cyl", "wand_stick", WAND, rot=(0, math.pi / 2, 0), radius=0.0045, depth=0.13, vertices=16)
w2 = prim("cyl", "wand_tipA", WAND_TIP, loc=(0.075, 0, 0), rot=(0, math.pi / 2, 0), radius=0.0048, depth=0.022, vertices=16)
w3 = prim("cyl", "wand_tipB", WAND_TIP, loc=(-0.075, 0, 0), rot=(0, math.pi / 2, 0), radius=0.0048, depth=0.022, vertices=16)
for o in (w1, w2, w3): bevel(o, 0.0012, 2); smooth(o)
wand = join([w1, w2, w3], "magic_wand")
wand.location.z = 0.0048
bpy.context.view_layer.objects.active = wand; wand.select_set(True)

# every prop is exported at the origin, so the app can keep each node's own transform
# (gltfpack-style quantisation stores its offset there)
bpy.data.objects["instant_camera"].location = (0, 0, 0)
crystal.location = (0, 0, 0)
wand.location = (0, 0, 0.0048)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT', export_extras=True)
print("exported", OUT)

# spread them out for the preview render only
crystal.location = (0.2, 0, 0)
wand.location = (0.38, 0, 0.0048)

if PREVIEW:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1400, 700
    world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.6, 0.78, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", 'SUN')); scene.collection.objects.link(sun)
    sun.data.energy = 3.5; sun.rotation_euler = (0.8, 0.1, -0.5)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 0.62
    cam.location = (0.19, -0.9, 0.42); cam.rotation_euler = (math.radians(65), 0, 0)
    scene.camera = cam
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    print("preview", PREVIEW)
