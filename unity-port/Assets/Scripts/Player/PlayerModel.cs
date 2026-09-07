// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — МОДЕЛЬ ПЕРСОНАЖА
//
//  Собирается из примитивов, как в веб-версии, но с настоящей иерархией
//  костей: плечо → локоть → кисть → пальцы, бедро → колено → стопа.
//  Благодаря этому анимация выглядит живой, а косметика цепляется
//  к правильным точкам и едет вместе с телом.
//
//  Пропорции пересчитаны под рост 1.8 м (в вебе модель была ~2.5 м).
//
//  АНИМАЦИЯ считается от РЕАЛЬНОЙ скорости персонажа, а не от строки
//  состояния — так переходы плавные, без рывка на смене «walk»→«run».
//  Всё сглаживание кадронезависимое: одинаково на 30 и 144 FPS.
// ═══════════════════════════════════════════════════════════════════════════
using UnityEngine;
using Fantazia.Core;

namespace Fantazia.Player
{
    public class PlayerModel : MonoBehaviour
    {
        [Header("Внешность")]
        public Color skin = new Color(0.94f, 0.78f, 0.65f);
        public Color shirt = new Color(0.36f, 0.62f, 0.82f);
        public Color pants = new Color(0.18f, 0.24f, 0.38f);
        public Color hair = new Color(0.35f, 0.22f, 0.12f);
        public Color shoes = new Color(0.12f, 0.12f, 0.14f);

        // кости — публичные, чтобы косметика и анимация их находили
        public Transform hips, torso, head, neck;
        public Transform armL, armR, elbowL, elbowR, handL, handR;
        public Transform legL, legR, kneeL, kneeR, footL, footR;
        public Transform eyeL, eyeR;

        public Transform headAnchor, backAnchor, bodyAnchor, handAnchor;

        Shader lit;
        Material mSkin, mShirt, mPants, mHair, mShoes, mEye;

        // состояние анимации
        float speed, prevX, prevZ, lean, prevRot, land, prevY, crouch, swing;
        float blink, blinkNext = 3f, headYaw, headPitch, idleT, fidget, fidgetNext = 7f;
        PlayerController pc;

        void Awake()
        {
            lit = Shader.Find("Universal Render Pipeline/Lit");
            if (lit == null) lit = Shader.Find("Standard");
            BuildMaterials();
            Build();
            pc = GetComponentInParent<PlayerController>();
        }

        void BuildMaterials()
        {
            mSkin = M(skin, 0f, 0.25f);
            mShirt = M(shirt, 0f, 0.35f);
            mPants = M(pants, 0f, 0.3f);
            mHair = M(hair, 0f, 0.4f);
            mShoes = M(shoes, 0.1f, 0.5f);
            mEye = M(Color.black, 0f, 0.8f);
        }

        Material M(Color c, float metal, float smooth)
        {
            var m = new Material(lit);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metal);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smooth);
            m.enableInstancing = true;
            return m;
        }

        Transform Bone(string name, Transform parent, Vector3 pos)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            return go.transform;
        }

        GameObject Part(string name, Transform parent, Vector3 pos, Vector3 scale,
                        Material mat, PrimitiveType pt = PrimitiveType.Cube)
        {
            var go = GameObject.CreatePrimitive(pt);
            go.name = name;
            var c = go.GetComponent<Collider>();
            if (c != null) Destroy(c);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }

        // ── СБОРКА СКЕЛЕТА ─────────────────────────────────────────────────
        void Build()
        {
            // ТАЗ — корень всей иерархии
            hips = Bone("Hips", transform, new Vector3(0f, 0.92f, 0f));
            Part("Pelvis", hips, Vector3.zero, new Vector3(0.34f, 0.22f, 0.22f), mPants);

            // ТОРС
            torso = Bone("Torso", hips, new Vector3(0f, 0.18f, 0f));
            Part("Chest", torso, new Vector3(0f, 0.16f, 0f),
                 new Vector3(0.42f, 0.44f, 0.24f), mShirt);
            // воротник и «плечевой пояс» — чтобы силуэт не был бруском
            Part("Collar", torso, new Vector3(0f, 0.40f, 0f),
                 new Vector3(0.30f, 0.08f, 0.22f), mShirt);

            // ШЕЯ И ГОЛОВА
            neck = Bone("Neck", torso, new Vector3(0f, 0.44f, 0f));
            Part("NeckMesh", neck, Vector3.zero, new Vector3(0.12f, 0.10f, 0.12f), mSkin);

            head = Bone("Head", neck, new Vector3(0f, 0.16f, 0f));
            Part("Skull", head, Vector3.zero, new Vector3(0.28f, 0.30f, 0.27f), mSkin);
            Part("Hair", head, new Vector3(0f, 0.13f, -0.01f),
                 new Vector3(0.30f, 0.10f, 0.29f), mHair);
            // глаза — отдельные кости, чтобы моргать масштабом
            eyeL = Bone("EyeL", head, new Vector3(-0.07f, 0.03f, 0.135f));
            Part("EyeLM", eyeL, Vector3.zero, new Vector3(0.05f, 0.05f, 0.02f), mEye);
            eyeR = Bone("EyeR", head, new Vector3(0.07f, 0.03f, 0.135f));
            Part("EyeRM", eyeR, Vector3.zero, new Vector3(0.05f, 0.05f, 0.02f), mEye);

            // РУКИ: плечо → локоть → кисть → пальцы
            armL = BuildArm(-1);
            armR = BuildArm(1);

            // НОГИ: бедро → колено → стопа
            legL = BuildLeg(-1);
            legR = BuildLeg(1);

            // ЯКОРЯ ДЛЯ КОСМЕТИКИ
            headAnchor = Bone("HeadAnchor", head, new Vector3(0f, 0.14f, 0f));
            backAnchor = Bone("BackAnchor", torso, new Vector3(0f, 0.20f, -0.14f));
            bodyAnchor = Bone("BodyAnchor", torso, new Vector3(0f, 0.10f, 0f));
            handAnchor = Bone("HandAnchor", handR != null ? handR : torso, Vector3.zero);
        }

        Transform BuildArm(int side)
        {
            var shoulder = Bone(side < 0 ? "ArmL" : "ArmR", torso,
                                new Vector3(side * 0.26f, 0.34f, 0f));
            Part("UpperArm", shoulder, new Vector3(0f, -0.14f, 0f),
                 new Vector3(0.11f, 0.30f, 0.11f), mShirt);

            var elbow = Bone(side < 0 ? "ElbowL" : "ElbowR", shoulder,
                             new Vector3(0f, -0.30f, 0f));
            Part("Forearm", elbow, new Vector3(0f, -0.13f, 0f),
                 new Vector3(0.095f, 0.26f, 0.095f), mSkin);

            var hand = Bone(side < 0 ? "HandL" : "HandR", elbow, new Vector3(0f, -0.28f, 0f));
            Part("Palm", hand, Vector3.zero, new Vector3(0.09f, 0.10f, 0.05f), mSkin);

            // пальцы: четыре + большой. Мелочь, но силуэт руки читается.
            for (int i = 0; i < 4; i++)
                Part("Finger" + i, hand, new Vector3((i - 1.5f) * 0.021f, -0.06f, 0.005f),
                     new Vector3(0.016f, 0.05f, 0.016f), mSkin);
            Part("Thumb", hand, new Vector3(-side * 0.045f, -0.025f, 0.02f),
                 new Vector3(0.018f, 0.04f, 0.018f), mSkin);

            if (side < 0) { elbowL = elbow; handL = hand; }
            else { elbowR = elbow; handR = hand; }
            return shoulder;
        }

        Transform BuildLeg(int side)
        {
            var hip = Bone(side < 0 ? "LegL" : "LegR", hips, new Vector3(side * 0.11f, -0.08f, 0f));
            Part("Thigh", hip, new Vector3(0f, -0.20f, 0f),
                 new Vector3(0.14f, 0.40f, 0.14f), mPants);

            var knee = Bone(side < 0 ? "KneeL" : "KneeR", hip, new Vector3(0f, -0.40f, 0f));
            Part("Shin", knee, new Vector3(0f, -0.18f, 0f),
                 new Vector3(0.12f, 0.36f, 0.12f), mPants);

            var foot = Bone(side < 0 ? "FootL" : "FootR", knee, new Vector3(0f, -0.36f, 0f));
            Part("Shoe", foot, new Vector3(0f, -0.03f, 0.04f),
                 new Vector3(0.14f, 0.08f, 0.24f), mShoes);

            if (side < 0) { kneeL = knee; footL = foot; }
            else { kneeR = knee; footR = foot; }
            return hip;
        }

        // ── АНИМАЦИЯ ───────────────────────────────────────────────────────
        static float Damp(float cur, float target, float lambda, float dt)
            => target + (cur - target) * Mathf.Exp(-lambda * dt);

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.1f);
            Vector3 pos = transform.root.position;

            // реальная скорость: телепорты (вход в здание) не считаем
            float dx = pos.x - prevX, dz = pos.z - prevZ;
            prevX = pos.x; prevZ = pos.z;
            float inst = Mathf.Sqrt(dx * dx + dz * dz) / Mathf.Max(dt, 0.0001f);
            if (inst < 40f) speed = Damp(speed, inst, 9f, dt);

            bool moving = speed > 0.35f;
            bool running = speed > 6.5f;
            float t = Time.time;

            // приседание
            bool wantCrouch = pc != null && pc.isCrouching;
            crouch = Damp(crouch, wantCrouch ? 1f : 0f, 10f, dt);

            // наклон в повороте
            float rot = transform.root.eulerAngles.y * Mathf.Deg2Rad;
            float dR = Mathf.DeltaAngle(prevRot * Mathf.Rad2Deg, rot * Mathf.Rad2Deg) * Mathf.Deg2Rad;
            prevRot = rot;
            lean = Damp(lean, moving ? Mathf.Clamp(-dR * 4.5f, -0.2f, 0.2f) : 0f, 7f, dt);

            // просадка при приземлении
            float dy = pos.y - prevY; prevY = pos.y;
            if (dy < -0.2f) land = 1f;
            if (land > 0f) land = Mathf.Max(0f, land - dt * 3.6f);

            // ── КОРПУС ──
            if (torso != null)
            {
                float breath = moving ? 0f : Mathf.Sin(t * 1.5f) * 0.012f;
                torso.localRotation = Quaternion.Euler(
                    running ? 9f : (moving ? 4f : 0f), 0f, lean * Mathf.Rad2Deg);
                torso.localPosition = new Vector3(0f, 0.18f - land * 0.08f - crouch * 0.16f + breath, 0f);
            }
            if (hips != null)
                hips.localPosition = new Vector3(0f, 0.92f - crouch * 0.26f - land * 0.04f, 0f);

            // ── ГОЛОВА ──
            if (head != null)
            {
                float yawT = 0f, pitchT = 0f;
                if (!moving)
                {
                    // в покое осматривается — иначе выглядит замороженным
                    yawT = Mathf.Sin(t * 0.35f) * 12f;
                    pitchT = Mathf.Sin(t * 0.27f) * 4f;
                }
                headYaw = Damp(headYaw, yawT, 6f, dt);
                headPitch = Damp(headPitch, pitchT, 6f, dt);
                head.localRotation = Quaternion.Euler(
                    headPitch + (moving ? -3f : 0f), headYaw, -lean * Mathf.Rad2Deg * 0.45f);
            }

            // ── МОРГАНИЕ ──
            blinkNext -= dt;
            if (blinkNext <= 0f) { blink = 0.14f; blinkNext = 2.4f + Random.value * 5f; }
            float eyeScale = 1f;
            if (blink > 0f)
            {
                blink -= dt;
                eyeScale = 1f - Mathf.Sin(Mathf.Max(0f, blink / 0.14f) * Mathf.PI) * 0.9f;
            }
            if (eyeL != null) eyeL.localScale = new Vector3(1f, eyeScale, 1f);
            if (eyeR != null) eyeR.localScale = new Vector3(1f, eyeScale, 1f);

            // ── КОНЕЧНОСТИ ──
            swing = Damp(swing, Mathf.Min(1f, speed / 8f), 8f, dt);
            float freq = running ? 10f : 6.5f;
            float ph = t * freq;
            float amp = 42f * swing;

            if (armL != null) armL.localRotation = Quaternion.Euler(Mathf.Sin(ph) * amp - crouch * 12f, 0f, 6f);
            if (armR != null) armR.localRotation = Quaternion.Euler(-Mathf.Sin(ph) * amp - crouch * 12f, 0f, -6f);
            float elbowBend = running ? -34f * swing : -8f * swing;
            if (elbowL != null) elbowL.localRotation = Quaternion.Euler(elbowBend, 0f, 0f);
            if (elbowR != null) elbowR.localRotation = Quaternion.Euler(elbowBend, 0f, 0f);

            float lamp = 40f * swing;
            if (legL != null) legL.localRotation = Quaternion.Euler(-Mathf.Sin(ph) * lamp - crouch * 30f, 0f, 0f);
            if (legR != null) legR.localRotation = Quaternion.Euler(Mathf.Sin(ph) * lamp - crouch * 30f, 0f, 0f);
            if (kneeL != null) kneeL.localRotation = Quaternion.Euler(Mathf.Max(0f, Mathf.Sin(ph + 0.6f)) * 34f * swing + crouch * 46f, 0f, 0f);
            if (kneeR != null) kneeR.localRotation = Quaternion.Euler(Mathf.Max(0f, Mathf.Sin(ph - 2.5f)) * 34f * swing + crouch * 46f, 0f, 0f);
            // стопа догоняет голень — без этого нога «плывёт»
            if (footL != null) footL.localRotation = Quaternion.Euler(Mathf.Sin(ph + 1.2f) * 12f * swing, 0f, 0f);
            if (footR != null) footR.localRotation = Quaternion.Euler(Mathf.Sin(ph - 1.9f) * 12f * swing, 0f, 0f);

            // ── МЕЛКИЕ ДВИЖЕНИЯ В ПОКОЕ ──
            if (!moving)
            {
                idleT += dt;
                fidgetNext -= dt;
                if (fidgetNext <= 0f) { fidget = 1.2f; fidgetNext = 7f + Random.value * 9f; }
                if (fidget > 0f)
                {
                    fidget -= dt;
                    float f = Mathf.Sin((1.2f - fidget) / 1.2f * Mathf.PI);
                    if (armR != null)
                        armR.localRotation = Quaternion.Euler(-f * 14f, 0f, -6f - f * 9f);
                }
            }
        }

        // Перекрасить модель (для редактора внешности)
        public void SetColors(Color? skinC = null, Color? shirtC = null,
                              Color? pantsC = null, Color? hairC = null)
        {
            if (skinC.HasValue && mSkin != null)
            {
                skin = skinC.Value;
                if (mSkin.HasProperty("_BaseColor")) mSkin.SetColor("_BaseColor", skin);
                if (mSkin.HasProperty("_Color")) mSkin.SetColor("_Color", skin);
            }
            if (shirtC.HasValue && mShirt != null)
            {
                shirt = shirtC.Value;
                if (mShirt.HasProperty("_BaseColor")) mShirt.SetColor("_BaseColor", shirt);
                if (mShirt.HasProperty("_Color")) mShirt.SetColor("_Color", shirt);
            }
            if (pantsC.HasValue && mPants != null)
            {
                pants = pantsC.Value;
                if (mPants.HasProperty("_BaseColor")) mPants.SetColor("_BaseColor", pants);
                if (mPants.HasProperty("_Color")) mPants.SetColor("_Color", pants);
            }
            if (hairC.HasValue && mHair != null)
            {
                hair = hairC.Value;
                if (mHair.HasProperty("_BaseColor")) mHair.SetColor("_BaseColor", hair);
                if (mHair.HasProperty("_Color")) mHair.SetColor("_Color", hair);
            }
        }
    }
}
