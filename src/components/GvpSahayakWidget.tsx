"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import {
  FaTimes,
  FaPaperPlane,
  FaHeadset,
  FaChevronDown,
  FaChevronUp,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaArrowLeft,
  FaPlus,
  FaQuestionCircle,
  FaComments,
  FaSync
} from "react-icons/fa";

interface Message {
  id: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  ticketNumber: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  _count?: { messages: number };
}

const FAQ_ITEMS = [
  {
    q: "How do I submit Mid Exam Draft marks?",
    category: "Mid Exams",
    a: "Navigate to Faculty > Mid Exam > Marks Entry. Enter the marks for each question. To save progress, click 'Save Draft'. Once all marks are verified, click 'Submit Draft' to finalize. Note that once submitted, you cannot edit without Admin approval."
  },
  {
    q: "How are Open Elective batches divided?",
    category: "Electives",
    a: "Open Electives (OE) students are enrolled college-wide. Admin maps them into Batch-1 and Batch-2 assigned to respective faculty. Your registered students will appear under your assigned OE batch."
  },
  {
    q: "Student roll number is not showing in my section",
    category: "Students",
    a: "Check if the student is assigned to another section or flagged under detained/rejoined status. If a newly admitted student is missing, please raise a ticket under 'Student Data' with their Roll Number and Section."
  },
  {
    q: "How to correct attendance posted with an error?",
    category: "Attendance",
    a: "Attendance submitted for a past date can be reviewed under Attendance > History. For date-level lock removal or student presence adjustment, raise a ticket with Date, Period, and Subject."
  }
];

const FACULTY_IDLE_THOUGHTS = [
  "🦁 Namaste! Need help? Click me anytime for GVP Sahayak helpdesk.",
  "✋ You can drag me anywhere with your mouse so I never block buttons!",
  "📝 Need mid-exam draft marks unlocked? Raise a query to Admin!",
  "⚡ Attendance or timetable query? I can connect you directly with Admin!",
  "🇮🇳 GVP Sahayak — designed for faculty ease!"
];

const ADMIN_IDLE_THOUGHTS = [
  "🦁 Hello Administrator! Click me to open Helpdesk Ticket Management.",
  "📋 Need to review faculty marks or attendance queries? Click here!",
  "✋ You can drag me anywhere with your mouse so I never block buttons!",
  "⚡ Live campus helpdesk support is active.",
  "🇮🇳 GVP Sahayak — campus command center!"
];

const SMS_USER_IDLE_THOUGHTS = [
  "🦁 Hello! Click me anytime to connect with Admin Helpdesk.",
  "✋ You can drag me anywhere on screen so I never block buttons!",
  "📋 Need attendance or messaging assistance? I'm here to help!",
  "⚡ GVP Sahayak — live campus helpdesk support is active.",
  "🇮🇳 GVP Sahayak — your campus companion!"
];

function FullBody3DLionMascot({
  isIdle,
  isHovered
}: {
  isIdle: boolean;
  isHovered: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 150 / 120, 0.1, 100);
    // Dynamic 3/4 perspective looking at the lion slightly from the front-side
    camera.position.set(2.2, 1.3, 3.8);
    camera.lookAt(0, 0.05, 0);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
      renderer.setSize(150, 120, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0); // 100% transparent background
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch (e) {
      console.error("WebGL initialization error:", e);
      return;
    }

    // 2. Realistic Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xfff6ec, 2.3);
    scene.add(ambientLight);

    const keySun = new THREE.DirectionalLight(0xfffaed, 3.2);
    keySun.position.set(5, 7, 5);
    scene.add(keySun);

    // Warm golden rim light across mane, flank, and back
    const rimLight = new THREE.PointLight(0xf59e0b, 3.8, 15);
    rimLight.position.set(-3.5, 3.0, -2.0);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xfef08a, 1.2);
    fillLight.position.set(-2.5, -1, 3.5);
    scene.add(fillLight);

    // 3. Iconic "Lion King" Palette & High-Quality Stylized Shaders
    // Rich golden honey-amber lion pelt (warm, vibrant Simba/Mufasa tone)
    const lionGold = new THREE.MeshStandardMaterial({
      color: 0xdf8c2f,
      roughness: 0.48,
      metalness: 0.02,
      flatShading: false
    });

    // Warm lighter cream underbelly, chest bib, and muzzle
    const lionCream = new THREE.MeshStandardMaterial({
      color: 0xfff3e0,
      roughness: 0.55,
      metalness: 0.01,
      flatShading: false
    });

    // Rich regal crimson-auburn mane (soft, sculpted lobes like the Lion King animation)
    const maneAuburn = new THREE.MeshStandardMaterial({
      color: 0x7a2208, // Royal crimson-chestnut
      roughness: 0.72,
      metalness: 0.03,
      flatShading: false
    });

    const maneHighlight = new THREE.MeshStandardMaterial({
      color: 0x9e3410, // Warm amber-chestnut highlight
      roughness: 0.68,
      metalness: 0.04,
      flatShading: false
    });

    const maneShadow = new THREE.MeshStandardMaterial({
      color: 0x481203, // Deep chestnut root shadow
      roughness: 0.8,
      metalness: 0.02,
      flatShading: false
    });

    // Warm luminous feline amber-hazel eyes with dark eyeliner rim
    const amberEyeMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.85,
      roughness: 0.1
    });

    const eyeRimMat = new THREE.MeshBasicMaterial({ color: 0x1f140e });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0705 });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });

    // Feline dark chocolate / leathery nose pad
    const lionNose = new THREE.MeshStandardMaterial({
      color: 0x2e1810,
      roughness: 0.35,
      metalness: 0.04,
      flatShading: false
    });

    const mouthMat = new THREE.MeshStandardMaterial({
      color: 0xd95d6a,
      roughness: 0.3,
      metalness: 0.05
    });

    const toothMat = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      roughness: 0.2
    });

    // 4. Constructing REALISTIC LION KING WALKING MASCOT
    // Proportionate, smaller, sculpted quadruped lion with articulated feline walking gait
    const lionGroup = new THREE.Group();
    lionGroup.scale.set(0.70, 0.70, 0.70);
    lionGroup.position.set(0, 0.05, 0);
    scene.add(lionGroup);

    // Master Body Group
    const bodyGroup = new THREE.Group();
    lionGroup.add(bodyGroup);

    // Muscular Deep Chest (broad feline ribcage)
    const chestGeo = new THREE.SphereGeometry(0.38, 20, 16);
    const chest = new THREE.Mesh(chestGeo, lionGold);
    chest.scale.set(1.15, 1.25, 1.35);
    chest.position.set(0, 0.06, 0.28);
    bodyGroup.add(chest);

    // Cream Fur Bib on lower throat & chest
    const bibGeo = new THREE.SphereGeometry(0.30, 16, 14, 0, Math.PI);
    const bib = new THREE.Mesh(bibGeo, lionCream);
    bib.rotation.x = -Math.PI / 2 + 0.1;
    bib.scale.set(0.85, 1.25, 0.65);
    bib.position.set(0, 0.01, 0.56);
    bodyGroup.add(bib);

    // Athletic Tapered Flank / Abdomen (feline abdominal tuck)
    const bellyGeo = new THREE.CylinderGeometry(0.30, 0.36, 0.50, 16);
    bellyGeo.rotateX(Math.PI / 2);
    const belly = new THREE.Mesh(bellyGeo, lionGold);
    belly.position.set(0, 0.04, -0.05);
    belly.scale.set(0.95, 0.88, 1.0);
    bodyGroup.add(belly);

    // Cream underbelly stripe
    const underbellyGeo = new THREE.CylinderGeometry(0.26, 0.30, 0.46, 12, 1, false, 0, Math.PI);
    underbellyGeo.rotateX(Math.PI / 2);
    underbellyGeo.rotateZ(Math.PI);
    const underbelly = new THREE.Mesh(underbellyGeo, lionCream);
    underbelly.position.set(0, -0.06, -0.05);
    bodyGroup.add(underbelly);

    // Powerful Rounded Rump / Pelvis (muscular feline hindquarters)
    const rumpGeo = new THREE.SphereGeometry(0.35, 20, 16);
    const rump = new THREE.Mesh(rumpGeo, lionGold);
    rump.scale.set(1.05, 1.15, 1.2);
    rump.position.set(0, 0.12, -0.42);
    bodyGroup.add(rump);

    // 4 ARTICULATED DIGITIGRADE LEGS FOR REALISTIC FELINE GAIT
    // Shoulder geometry for front legs
    const shoulderGeo = new THREE.SphereGeometry(0.12, 14, 12);
    const pawGeo = new THREE.SphereGeometry(0.10, 14, 10);

    // Front Left Leg
    const flGroup = new THREE.Group();
    flGroup.position.set(-0.27, 0.10, 0.36);
    bodyGroup.add(flGroup);

    const flScapula = new THREE.Mesh(shoulderGeo, lionGold);
    flScapula.scale.set(0.9, 1.3, 1.1);
    flGroup.add(flScapula);

    const flUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.34, 12), lionGold);
    flUpper.position.set(0, -0.17, 0);
    flGroup.add(flUpper);

    const flKnee = new THREE.Group();
    flKnee.position.set(0, -0.34, 0);
    flGroup.add(flKnee);

    const flLower = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.32, 12), lionGold);
    flLower.position.set(0, -0.16, 0);
    flKnee.add(flLower);

    const flPaw = new THREE.Mesh(pawGeo, lionCream);
    flPaw.scale.set(1.15, 0.52, 1.4);
    flPaw.position.set(0, -0.32, 0.03);
    flKnee.add(flPaw);

    // Front Right Leg
    const frGroup = new THREE.Group();
    frGroup.position.set(0.27, 0.10, 0.36);
    bodyGroup.add(frGroup);

    const frScapula = new THREE.Mesh(shoulderGeo, lionGold);
    frScapula.scale.set(0.9, 1.3, 1.1);
    frGroup.add(frScapula);

    const frUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.34, 12), lionGold);
    frUpper.position.set(0, -0.17, 0);
    frGroup.add(frUpper);

    const frKnee = new THREE.Group();
    frKnee.position.set(0, -0.34, 0);
    frGroup.add(frKnee);

    const frLower = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.32, 12), lionGold);
    frLower.position.set(0, -0.16, 0);
    frKnee.add(frLower);

    const frPaw = new THREE.Mesh(pawGeo, lionCream);
    frPaw.scale.set(1.15, 0.52, 1.4);
    frPaw.position.set(0, -0.32, 0.03);
    frKnee.add(frPaw);

    // Hind Left Leg (Digitigrade feline leg with muscular curved thigh)
    const thighGeo = new THREE.SphereGeometry(0.18, 14, 12);

    const hlGroup = new THREE.Group();
    hlGroup.position.set(-0.29, 0.14, -0.42);
    bodyGroup.add(hlGroup);

    const hlThigh = new THREE.Mesh(thighGeo, lionGold);
    hlThigh.scale.set(0.85, 1.35, 1.15);
    hlThigh.position.set(0, -0.06, 0);
    hlGroup.add(hlThigh);

    const hlKnee = new THREE.Group();
    hlKnee.position.set(0, -0.28, -0.04);
    hlGroup.add(hlKnee);

    const hlLower = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, 0.34, 12), lionGold);
    hlLower.position.set(0, -0.17, 0.03);
    hlLower.rotation.x = 0.15;
    hlKnee.add(hlLower);

    const hlPaw = new THREE.Mesh(pawGeo, lionCream);
    hlPaw.scale.set(1.15, 0.52, 1.4);
    hlPaw.position.set(0, -0.34, 0.06);
    hlKnee.add(hlPaw);

    // Hind Right Leg
    const hrGroup = new THREE.Group();
    hrGroup.position.set(0.29, 0.14, -0.42);
    bodyGroup.add(hrGroup);

    const hrThigh = new THREE.Mesh(thighGeo, lionGold);
    hrThigh.scale.set(0.85, 1.35, 1.15);
    hrThigh.position.set(0, -0.06, 0);
    hrGroup.add(hrThigh);

    const hrKnee = new THREE.Group();
    hrKnee.position.set(0, -0.28, -0.04);
    hrGroup.add(hrKnee);

    const hrLower = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, 0.34, 12), lionGold);
    hrLower.position.set(0, -0.17, 0.03);
    hrLower.rotation.x = 0.15;
    hrKnee.add(hrLower);

    const hrPaw = new THREE.Mesh(pawGeo, lionCream);
    hrPaw.scale.set(1.15, 0.52, 1.4);
    hrPaw.position.set(0, -0.34, 0.06);
    hrKnee.add(hrPaw);

    // Fluid Feline Tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.20, -0.62);
    bodyGroup.add(tailGroup);

    const tailCurve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.62, 10), lionGold);
    tailCurve.position.set(0, -0.24, -0.12);
    tailCurve.rotation.x = -0.42;
    tailGroup.add(tailCurve);

    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), maneAuburn);
    tailTip.scale.set(1.0, 1.4, 1.0);
    tailTip.position.set(0, -0.52, -0.24);
    tailGroup.add(tailTip);

    // B. Iconic Lion King Head & Sculpted Auburn Mane
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.56, 0.62);
    lionGroup.add(headGroup);

    // Sculpted Volumetric Mane: Soft overlapping smooth curved fur lobes (Lion King animation style!)
    const maneGroup = new THREE.Group();
    headGroup.add(maneGroup);

    // 1. Back Mane Shroud (Surrounding the neck and framing head regally)
    const maneBackGeo = new THREE.SphereGeometry(0.72, 20, 16);
    const maneBack = new THREE.Mesh(maneBackGeo, maneShadow);
    maneBack.scale.set(1.15, 1.25, 0.95);
    maneBack.position.set(0, 0.04, -0.25);
    maneGroup.add(maneBack);

    // 2. Sculpted Fluffy Mane Lobes framing the cheeks and shoulders
    const lobeGeo = new THREE.SphereGeometry(0.28, 14, 12);
    // Left upper, mid, lower locks
    const lMane1 = new THREE.Mesh(lobeGeo, maneAuburn);
    lMane1.scale.set(1.0, 1.45, 0.9);
    lMane1.position.set(-0.52, 0.16, -0.05);
    lMane1.rotation.set(-0.15, 0.3, 0.45);
    maneGroup.add(lMane1);

    const lMane2 = new THREE.Mesh(lobeGeo, maneHighlight);
    lMane2.scale.set(1.05, 1.5, 0.95);
    lMane2.position.set(-0.56, -0.18, 0.02);
    lMane2.rotation.set(-0.1, 0.35, 0.2);
    maneGroup.add(lMane2);

    const lMane3 = new THREE.Mesh(lobeGeo, maneAuburn);
    lMane3.scale.set(0.95, 1.35, 0.85);
    lMane3.position.set(-0.46, -0.46, 0.08);
    lMane3.rotation.set(0.1, 0.25, -0.15);
    maneGroup.add(lMane3);

    // Right upper, mid, lower locks
    const rMane1 = new THREE.Mesh(lobeGeo, maneAuburn);
    rMane1.scale.set(1.0, 1.45, 0.9);
    rMane1.position.set(0.52, 0.16, -0.05);
    rMane1.rotation.set(-0.15, -0.3, -0.45);
    maneGroup.add(rMane1);

    const rMane2 = new THREE.Mesh(lobeGeo, maneHighlight);
    rMane2.scale.set(1.05, 1.5, 0.95);
    rMane2.position.set(0.56, -0.18, 0.02);
    rMane2.rotation.set(-0.1, -0.35, -0.2);
    maneGroup.add(rMane2);

    const rMane3 = new THREE.Mesh(lobeGeo, maneAuburn);
    rMane3.scale.set(0.95, 1.35, 0.85);
    rMane3.position.set(0.46, -0.46, 0.08);
    rMane3.rotation.set(0.1, -0.25, 0.15);
    maneGroup.add(rMane3);

    // 3. Top Crown Locks (Iconic Lion King Forehead Crest!)
    const crestGeo = new THREE.ConeGeometry(0.20, 0.55, 7);
    const crestCenter = new THREE.Mesh(crestGeo, maneHighlight);
    crestCenter.position.set(0, 0.58, 0.06);
    crestCenter.rotation.set(-0.5, 0, 0);
    maneGroup.add(crestCenter);

    const crestL = new THREE.Mesh(crestGeo, maneAuburn);
    crestL.scale.set(0.85, 0.85, 0.85);
    crestL.position.set(-0.20, 0.50, 0.02);
    crestL.rotation.set(-0.45, 0.15, 0.35);
    maneGroup.add(crestL);

    const crestR = new THREE.Mesh(crestGeo, maneAuburn);
    crestR.scale.set(0.85, 0.85, 0.85);
    crestR.position.set(0.20, 0.50, 0.02);
    crestR.rotation.set(-0.45, -0.15, -0.35);
    maneGroup.add(crestR);

    // 4. Smooth Feline Skull (Distinctive feline skull with wide cheekbones)
    const skullGeo = new THREE.SphereGeometry(0.46, 18, 16);
    const skull = new THREE.Mesh(skullGeo, lionGold);
    skull.scale.set(1.15, 1.05, 1.15);
    skull.position.set(0, 0.06, 0.18);
    headGroup.add(skull);

    // Feline Cream Whisker Muzzle (Hearty rounded feline snout)
    const muzzleGeo = new THREE.SphereGeometry(0.20, 16, 14);
    const muzzleL = new THREE.Mesh(muzzleGeo, lionCream);
    muzzleL.scale.set(1.1, 0.88, 1.25);
    muzzleL.position.set(-0.14, -0.08, 0.60);
    headGroup.add(muzzleL);

    const muzzleR = new THREE.Mesh(muzzleGeo, lionCream);
    muzzleR.scale.set(1.1, 0.88, 1.25);
    muzzleR.position.set(0.14, -0.08, 0.60);
    headGroup.add(muzzleR);

    // Cream Feline Chin
    const chinGeo = new THREE.SphereGeometry(0.18, 12, 10);
    const chin = new THREE.Mesh(chinGeo, lionCream);
    chin.scale.set(0.88, 0.65, 1.15);
    chin.position.set(0, -0.18, 0.56);
    headGroup.add(chin);

    // Flat Lion Nose Bridge (Tapered golden dorsal)
    const bridgeGeo = new THREE.CylinderGeometry(0.10, 0.14, 0.38, 10);
    bridgeGeo.rotateX(-0.42);
    const bridge = new THREE.Mesh(bridgeGeo, lionGold);
    bridge.position.set(0, 0.08, 0.52);
    headGroup.add(bridge);

    // Triangular Feline Dark Chocolate Nose Pad
    const noseGeo = new THREE.ConeGeometry(0.12, 0.13, 3);
    const nose = new THREE.Mesh(noseGeo, lionNose);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.z = Math.PI;
    nose.position.set(0, 0.01, 0.78);
    headGroup.add(nose);

    // Expressive Large Amber Eyes with Sclera & Eyeliner (Classic Lion King Eye Design!)
    // Left Eye
    const eyeSocketGeo = new THREE.SphereGeometry(0.09, 14, 12);
    const lSclera = new THREE.Mesh(eyeSocketGeo, eyeWhiteMat);
    lSclera.scale.set(1.1, 0.85, 0.6);
    lSclera.position.set(-0.21, 0.15, 0.56);
    headGroup.add(lSclera);

    const lIris = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), amberEyeMat);
    lIris.position.set(-0.21, 0.15, 0.60);
    lIris.scale.set(1.0, 0.9, 0.4);
    headGroup.add(lIris);

    const lPupil = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.075, 0.025), pupilMat);
    lPupil.position.set(-0.21, 0.15, 0.635);
    headGroup.add(lPupil);

    const lEyeRim = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 16), eyeRimMat);
    lEyeRim.position.set(-0.21, 0.15, 0.59);
    lEyeRim.scale.set(1.15, 0.85, 0.6);
    headGroup.add(lEyeRim);

    // Right Eye
    const rSclera = new THREE.Mesh(eyeSocketGeo, eyeWhiteMat);
    rSclera.scale.set(1.1, 0.85, 0.6);
    rSclera.position.set(0.21, 0.15, 0.56);
    headGroup.add(rSclera);

    const rIris = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), amberEyeMat);
    rIris.position.set(0.21, 0.15, 0.60);
    rIris.scale.set(1.0, 0.9, 0.4);
    headGroup.add(rIris);

    const rPupil = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.075, 0.025), pupilMat);
    rPupil.position.set(0.21, 0.15, 0.635);
    headGroup.add(rPupil);

    const rEyeRim = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 16), eyeRimMat);
    rEyeRim.position.set(0.21, 0.15, 0.59);
    rEyeRim.scale.set(1.15, 0.85, 0.6);
    headGroup.add(rEyeRim);

    // Rounded Lion Ears with Dark Outer Shell & Cream Center
    const earGeo = new THREE.SphereGeometry(0.15, 12, 10, 0, Math.PI);
    const leftEar = new THREE.Mesh(earGeo, maneAuburn);
    leftEar.rotation.set(-0.2, 0.35, 0.45);
    leftEar.position.set(-0.40, 0.48, 0.10);
    headGroup.add(leftEar);

    const leftEarInner = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI), lionCream);
    leftEarInner.rotation.set(-0.2, 0.35, 0.45);
    leftEarInner.position.set(-0.39, 0.48, 0.12);
    headGroup.add(leftEarInner);

    const rightEar = new THREE.Mesh(earGeo, maneAuburn);
    rightEar.rotation.set(-0.2, -0.35, -0.45);
    rightEar.position.set(0.40, 0.48, 0.10);
    headGroup.add(rightEar);

    const rightEarInner = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI), lionCream);
    rightEarInner.rotation.set(-0.2, -0.35, -0.45);
    rightEarInner.position.set(0.39, 0.48, 0.12);
    headGroup.add(rightEarInner);

    // Articulated Mouth / Lower Jaw for expressive roaring/greeting
    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, -0.14, 0.48);
    headGroup.add(jawGroup);

    const jawTongue = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.16), mouthMat);
    jawTongue.position.set(0, 0.02, 0.10);
    jawGroup.add(jawTongue);

    const lCanine = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.10, 5), toothMat);
    lCanine.position.set(-0.07, 0.05, 0.15);
    jawGroup.add(lCanine);

    const rCanine = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.10, 5), toothMat);
    rCanine.position.set(0.07, 0.05, 0.15);
    jawGroup.add(rCanine);

    // 5. Cursor Tracking Setup
    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (e.clientX - centerX) / (window.innerWidth / 2);
      const dy = (e.clientY - centerY) / (window.innerHeight / 2);
      mouse.x = Math.max(-1, Math.min(1, dx));
      mouse.y = Math.max(-1, Math.min(1, dy));
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // 6. Dynamic Regal Animations & Realistic Walking Idle Behaviors
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let walkPhase = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      // Pacing cycle (28s cycle matching the motion.div wander)
      // 0 - 5.5s: Walking Left
      // 5.5 - 8.0s: Stop at left, roar/yawn
      // 8.0 - 13.5s: Walking Right back to center
      // 13.5 - 21.0s: Survey pride lands (head panning left/right)
      // 21.0 - 28.0s: Calm breathing & alert standing
      const cycle = time % 28;
      let isWalking = false;
      let targetLionRotY = 0;
      let targetLookX = 0;
      let targetLookY = 0;
      let jawOpen = 0;

      if (isIdle) {
        if (cycle >= 0 && cycle < 5.5) {
          // Walking Left
          isWalking = true;
          targetLionRotY = -Math.PI * 0.38; // Face 3/4 front-left
        } else if (cycle >= 5.5 && cycle < 8.0) {
          // Paused at left: Majestic Roar / Yawn
          isWalking = false;
          targetLionRotY = -Math.PI * 0.18;
          const roarT = Math.sin(((cycle - 5.5) / 2.5) * Math.PI);
          targetLookX = -0.25 * roarT; // Looks up regally
          jawOpen = roarT * 0.45;
        } else if (cycle >= 8.0 && cycle < 13.5) {
          // Walking Right
          isWalking = true;
          targetLionRotY = Math.PI * 0.38; // Face 3/4 front-right
        } else if (cycle >= 13.5 && cycle < 21.0) {
          // At home: Surveying domain (looking left to right)
          isWalking = false;
          targetLionRotY = 0;
          targetLookX = 0.04;
          targetLookY = Math.sin((cycle - 13.5) * 0.9) * 0.45;
        } else {
          // Standing calmly, breathing proudly
          isWalking = false;
          targetLionRotY = 0;
          targetLookX = Math.sin(time * 1.5) * 0.06;
          targetLookY = Math.cos(time * 0.8) * 0.12;
        }
      } else {
        // Active mode (user is interacting / moving mouse):
        isWalking = false;
        targetLionRotY = 0;
        // Head & eyes track mouse cursor smoothly!
        targetLookX = -mouse.y * 0.32;
        targetLookY = mouse.x * 0.52;
      }

      // Smoothly rotate lion body to facing direction
      lionGroup.rotation.y = THREE.MathUtils.lerp(lionGroup.rotation.y, targetLionRotY, 0.08);

      // Smooth Head Rotation
      headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, targetLookX, 0.08);
      headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, targetLookY, 0.08);

      // Jaw Articulation
      jawGroup.rotation.x = THREE.MathUtils.lerp(jawGroup.rotation.x, jawOpen, 0.15);

      if (isWalking) {
        walkPhase += delta * 5.4;

        // Feline diagonal walking gait
        const pFL = walkPhase;
        const pFR = walkPhase + Math.PI;
        const pHL = walkPhase + 1.8;
        const pHR = walkPhase + Math.PI + 1.8;

        // Front Left Leg
        const flSwing = Math.sin(pFL);
        flGroup.rotation.x = THREE.MathUtils.lerp(flGroup.rotation.x, flSwing * 0.52, 0.2);
        flKnee.rotation.x = THREE.MathUtils.lerp(flKnee.rotation.x, Math.max(0, -Math.cos(pFL) * 0.65), 0.2);

        // Front Right Leg
        const frSwing = Math.sin(pFR);
        frGroup.rotation.x = THREE.MathUtils.lerp(frGroup.rotation.x, frSwing * 0.52, 0.2);
        frKnee.rotation.x = THREE.MathUtils.lerp(frKnee.rotation.x, Math.max(0, -Math.cos(pFR) * 0.65), 0.2);

        // Hind Left Leg
        const hlSwing = Math.sin(pHL);
        hlGroup.rotation.x = THREE.MathUtils.lerp(hlGroup.rotation.x, hlSwing * 0.48, 0.2);
        hlKnee.rotation.x = THREE.MathUtils.lerp(hlKnee.rotation.x, Math.max(0, Math.cos(pHL) * 0.55), 0.2);

        // Hind Right Leg
        const hrSwing = Math.sin(pHR);
        hrGroup.rotation.x = THREE.MathUtils.lerp(hrGroup.rotation.x, hrSwing * 0.48, 0.2);
        hrKnee.rotation.x = THREE.MathUtils.lerp(hrKnee.rotation.x, Math.max(0, Math.cos(pHR) * 0.55), 0.2);

        // Torso walking bounce & roll
        const bounce = Math.abs(Math.sin(walkPhase * 2)) * 0.03;
        bodyGroup.position.y = THREE.MathUtils.lerp(bodyGroup.position.y, bounce, 0.2);
        bodyGroup.rotation.z = THREE.MathUtils.lerp(bodyGroup.rotation.z, Math.sin(walkPhase) * 0.04, 0.2);
        bodyGroup.rotation.y = THREE.MathUtils.lerp(bodyGroup.rotation.y, Math.cos(walkPhase) * 0.03, 0.2);

        // Tail sway in walk rhythm
        tailGroup.rotation.y = Math.sin(walkPhase) * 0.35;
        tailGroup.rotation.z = Math.cos(walkPhase) * 0.15;
      } else {
        // Return legs and body smoothly to dignified standing posture
        flGroup.rotation.x = THREE.MathUtils.lerp(flGroup.rotation.x, 0, 0.12);
        flKnee.rotation.x = THREE.MathUtils.lerp(flKnee.rotation.x, 0, 0.12);
        frGroup.rotation.x = THREE.MathUtils.lerp(frGroup.rotation.x, 0, 0.12);
        frKnee.rotation.x = THREE.MathUtils.lerp(frKnee.rotation.x, 0, 0.12);

        hlGroup.rotation.x = THREE.MathUtils.lerp(hlGroup.rotation.x, 0, 0.12);
        hlKnee.rotation.x = THREE.MathUtils.lerp(hlKnee.rotation.x, 0, 0.12);
        hrGroup.rotation.x = THREE.MathUtils.lerp(hrGroup.rotation.x, 0, 0.12);
        hrKnee.rotation.x = THREE.MathUtils.lerp(hrKnee.rotation.x, 0, 0.12);

        bodyGroup.rotation.z = THREE.MathUtils.lerp(bodyGroup.rotation.z, 0, 0.12);
        bodyGroup.rotation.y = THREE.MathUtils.lerp(bodyGroup.rotation.y, 0, 0.12);

        // Deep Chest Breathing Motion while standing
        const breath = Math.sin(time * 2.2);
        chest.scale.x = 1.15 + breath * 0.02;
        chest.scale.z = 1.35 + breath * 0.02;
        bodyGroup.position.y = THREE.MathUtils.lerp(bodyGroup.position.y, breath * 0.015, 0.1);

        // Lazy Tail Swishing
        tailGroup.rotation.y = Math.sin(time * 2.2) * 0.28;
        tailGroup.rotation.z = Math.cos(time * 2.2) * 0.12;
      }

      // Mane Gentle Breathing Shimmer
      maneGroup.rotation.z = Math.sin(time * 1.8) * 0.02;

      // Hover scaling (smaller and compact)
      const targetScale = isHovered ? 0.78 : 0.70;
      lionGroup.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

      if (renderer) {
        renderer.render(scene, camera);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", onMouseMove);
      if (renderer) {
        renderer.dispose();
      }
    };
  }, [isIdle, isHovered]);

  return (
    <canvas
      ref={canvasRef}
      className="w-32 h-28 sm:w-36 sm:h-32 drop-shadow-xl select-none pointer-events-none"
    />
  );
}

export default function GvpSahayakWidget() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"FAQS" | "TICKETS" | "NEW">("FAQS");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Tickets state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [loadingActiveTicket, setLoadingActiveTicket] = useState(false);

  // New ticket form
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("MID_EXAMS");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newMessage, setNewMessage] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Chat message input
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Role permissions
  const isAdmin = user?.role === "ADMIN";
  const isFacultyOrHod = user?.role === "FACULTY" || user?.role === "HOD";
  const isSmsUser = user?.role === "SMS_USER";
  const canAccess = isFacultyOrHod || isAdmin || isSmsUser;

  const currentThoughts = isAdmin
    ? ADMIN_IDLE_THOUGHTS
    : isSmsUser
    ? SMS_USER_IDLE_THOUGHTS
    : FACULTY_IDLE_THOUGHTS;

  // Draggable mascot & Idle state
  const [isIdle, setIsIdle] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [idleThoughtIndex, setIdleThoughtIndex] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const [constraints, setConstraints] = useState({ top: -600, bottom: 0, left: -1000, right: 0 });

  const isDraggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Update window constraints on mount and resize
  useEffect(() => {
    const updateConstraints = () => {
      if (typeof window !== "undefined") {
        setConstraints({
          top: -window.innerHeight + 100,
          bottom: 0,
          left: -window.innerWidth + 100,
          right: 0
        });
      }
    };
    updateConstraints();
    window.addEventListener("resize", updateConstraints);
    return () => window.removeEventListener("resize", updateConstraints);
  }, []);

  // Idle detection: 5 seconds of no user interaction triggers idle patrolling animation & speech bubble
  useEffect(() => {
    let idleTimeout: NodeJS.Timeout;
    let cycleInterval: NodeJS.Timeout;

    const resetIdle = () => {
      setIsIdle(false);
      setShowBubble(false);
      clearTimeout(idleTimeout);
      clearInterval(cycleInterval);

      idleTimeout = setTimeout(() => {
        setIsIdle(true);
        setShowBubble(true);
        // Cycle tips while idle
        cycleInterval = setInterval(() => {
          setIdleThoughtIndex((prev) => (prev + 1) % currentThoughts.length);
        }, 7000);
      }, 5000);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((evt) => window.addEventListener(evt, resetIdle, { passive: true }));

    resetIdle();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetIdle));
      clearTimeout(idleTimeout);
      clearInterval(cycleInterval);
    };
  }, [currentThoughts.length]);

  const handleDragStart = (_: any, info: any) => {
    isDraggingRef.current = true;
    dragStartPos.current = { x: info.point.x, y: info.point.y };
  };

  const handleDragEnd = (_: any, info: any) => {
    const dist = Math.hypot(info.point.x - dragStartPos.current.x, info.point.y - dragStartPos.current.y);
    if (dist > 4) {
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 150);
    } else {
      isDraggingRef.current = false;
    }
  };

  const handleMascotClick = () => {
    if (isDraggingRef.current) return;
    if (isAdmin) {
      // Approach A: Clicking takes Admin straight to the Admin Tickets screen
      router.push("/admin/helpdesk");
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    if (canAccess && (isOpen || isAdmin)) {
      fetchTickets();
    }
  }, [canAccess, isOpen, isAdmin]);

  useEffect(() => {
    if (activeTicket) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTicket?.messages]);

  if (!canAccess) return null;

  const fetchTickets = async () => {
    try {
      setLoadingTickets(true);
      const res = await fetch("/api/helpdesk/tickets");
      const json = await res.json();
      if (json.success) {
        setTickets(json.tickets || []);
      }
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const openTicketDetail = async (ticketId: string) => {
    try {
      setLoadingActiveTicket(true);
      const res = await fetch(`/api/helpdesk/tickets/${ticketId}`);
      const json = await res.json();
      if (json.success) {
        setActiveTicket(json.ticket);
      }
    } catch (err) {
      console.error("Failed to load ticket detail:", err);
    } finally {
      setLoadingActiveTicket(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMessage.trim()) {
      setSubmitError("Please fill in both the title and query details.");
      return;
    }

    try {
      setSubmittingTicket(true);
      setSubmitError("");

      const res = await fetch("/api/helpdesk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          category: newCategory,
          priority: newPriority,
          message: newMessage
        })
      });

      const json = await res.json();
      if (json.success) {
        setNewTitle("");
        setNewMessage("");
        setNewCategory("MID_EXAMS");
        setNewPriority("MEDIUM");
        await fetchTickets();
        // Open the newly created ticket directly
        if (json.ticket) {
          openTicketDetail(json.ticket.id);
        } else {
          setActiveTab("TICKETS");
        }
      } else {
        setSubmitError(json.error || "Failed to create ticket.");
      }
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred.");
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !activeTicket) return;

    try {
      setSendingReply(true);
      const res = await fetch(`/api/helpdesk/tickets/${activeTicket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage })
      });

      const json = await res.json();
      if (json.success) {
        setReplyMessage("");
        // Refresh ticket details
        openTicketDetail(activeTicket.id);
        fetchTickets();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            <FaCheckCircle className="text-emerald-600 text-[10px]" /> Resolved
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            <FaClock className="text-amber-600 text-[10px]" /> In Progress
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
            <FaExclamationCircle className="text-rose-600 text-[10px]" /> Open
          </span>
        );
    }
  };

  const openTicketsCount = tickets.filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS").length;

  return (
    <>
      {/* Draggable Animated Realistic Lion Mascot */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.08}
        dragConstraints={constraints}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={
          isIdle
            ? {
                x: [0, -320, -320, 0, 0, 0],
                y: [0, -3, 0, -3, 0, 0],
                transition: {
                  x: {
                    repeat: Infinity,
                    duration: 28,
                    times: [0, 0.196, 0.285, 0.482, 0.75, 1], // Matches 0-5.5s, 5.5-8.0s, 8.0-13.5s, 13.5-21s, 21-28s
                    ease: "easeInOut"
                  },
                  y: {
                    repeat: Infinity,
                    duration: 3.5,
                    ease: "easeInOut"
                  }
                }
              }
            : {
                x: 0,
                y: [0, -4, 0],
                transition: {
                  x: { type: "spring", stiffness: 300, damping: 25 },
                  y: {
                    repeat: Infinity,
                    duration: 3,
                    ease: "easeInOut"
                  }
                }
              }
        }
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-5 right-5 z-40 select-none cursor-grab active:cursor-grabbing flex flex-col items-center"
      >
        {/* Floating Idle Thought / Tip Bubble */}
        <AnimatePresence>
          {showBubble && !isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.85 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-full right-0 mb-3 w-56 sm:w-64 rounded-2xl bg-slate-900/95 p-3 text-white shadow-2xl border border-amber-400/40 backdrop-blur-md z-50 pointer-events-auto"
            >
              <div className="flex items-start justify-between gap-1.5 mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  🦁 Sahayak Tip
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBubble(false);
                  }}
                  className="text-slate-400 hover:text-white p-0.5 rounded transition"
                  title="Dismiss tip"
                >
                  <FaTimes size={10} />
                </button>
              </div>
              <p className="text-xs text-slate-100 font-medium leading-relaxed">
                {currentThoughts[idleThoughtIndex % currentThoughts.length]}
              </p>
              <div className="mt-2 flex items-center justify-between text-[9px] text-amber-300/80 font-mono pt-1.5 border-t border-slate-800">
                <span>🖱️ Drag anywhere</span>
                <span>{isAdmin ? "👆 Click for tickets" : "👆 Click to open"}</span>
              </div>
              {/* Bubble Arrow Tail */}
              <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 bg-slate-900 border-r border-b border-amber-400/40"></div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3D Mascot Trigger Area (True Full-Body 3D Model, No Circular Disc) */}
        <div
          onClick={handleMascotClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative group flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          {/* Subtle Ambient 3D Depth Glow */}
          <div
            className={`absolute inset-2 rounded-full bg-gradient-to-r from-amber-500/25 via-indigo-600/30 to-amber-500/25 blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${
              isIdle ? "animate-pulse" : ""
            }`}
          />

          {/* Three.js Full-Body 3D WebGL Make-in-India Lion */}
          <div className="relative z-10 flex items-center justify-center">
            <FullBody3DLionMascot isIdle={isIdle} isHovered={isHovered} />
          </div>

          {/* Unread / Active Tickets Counter Pill */}
          {openTicketsCount > 0 && (
            <span className="absolute top-1 right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-extrabold text-white ring-2 ring-white shadow-md animate-bounce">
              {openTicketsCount}
            </span>
          )}

          {/* Online green indicator dot */}
          <span className="absolute bottom-2 right-4 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </span>
        </div>

        {/* Floating Label / Drag Hint Pill */}
        <div
          onClick={handleMascotClick}
          className="mt-0.5 flex items-center gap-1.5 rounded-full bg-slate-900/90 px-2.5 py-0.5 text-white shadow-lg border border-amber-400/30 backdrop-blur-xs group-hover:border-amber-400 transition"
        >
          <span className="text-[10px] font-bold text-amber-300">
            GVP Sahayak
          </span>
          <span className="text-[8px] text-slate-300 font-mono hidden group-hover:inline">
            {isAdmin ? "(click for tickets)" : "(drag me)"}
          </span>
        </div>
      </motion.div>

      {/* Floating Chat Modal / Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-20 right-4 sm:right-6 z-50 w-[94vw] max-w-md sm:w-[410px] h-[610px] max-h-[82vh] rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 p-4 text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs text-white">
                  <FaHeadset className="text-lg" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm tracking-tight text-white leading-tight">GVP Sahayak</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.2 text-[9px] font-bold text-emerald-200 border border-emerald-300/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-100 font-medium leading-tight">Faculty Helpdesk & Query Assistant</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition"
                title="Close"
              >
                <FaTimes size={15} />
              </button>
            </div>

            {/* If an active ticket is selected, display the Chat Thread */}
            {activeTicket ? (
              <div className="flex flex-col flex-1 overflow-hidden bg-slate-50/60">
                {/* Active Ticket Header */}
                <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xs">
                  <button
                    onClick={() => setActiveTicket(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition"
                  >
                    <FaArrowLeft className="text-[11px]" /> Back
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 font-mono">#{activeTicket.ticketNumber}</span>
                    {getStatusBadge(activeTicket.status)}
                  </div>
                </div>

                {/* Ticket Title Banner */}
                <div className="bg-indigo-50/40 border-b border-indigo-100/60 px-4 py-2 text-xs">
                  <p className="font-bold text-slate-900 leading-snug line-clamp-1">{activeTicket.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Category: <span className="font-semibold text-indigo-700">{activeTicket.category}</span></p>
                </div>

                {/* Resolution Banner if Resolved */}
                {activeTicket.status === "RESOLVED" && (
                  <div className="m-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-900 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px] mb-1">
                      <FaCheckCircle className="text-emerald-600" /> Resolved by Administrator
                    </div>
                    {activeTicket.resolutionNotes ? (
                      <p className="text-[11px] text-emerald-800/90 font-medium leading-relaxed">{activeTicket.resolutionNotes}</p>
                    ) : (
                      <p className="text-[11px] text-emerald-700 italic">This query has been marked as resolved.</p>
                    )}
                  </div>
                )}

                {/* Message Bubbles Thread */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-200">
                  {loadingActiveTicket ? (
                    <div className="flex h-32 items-center justify-center text-xs text-slate-400">
                      <FaSync className="animate-spin mr-2" /> Loading conversation...
                    </div>
                  ) : activeTicket.messages && activeTicket.messages.length > 0 ? (
                    activeTicket.messages.map((msg, i) => {
                      const isMe = msg.senderRole === "FACULTY" || msg.senderRole === "HOD";
                      return (
                        <div
                          key={msg.id || i}
                          className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1 px-1">
                            <span className="font-semibold text-slate-600">{msg.senderName}</span>
                            {!isMe && (
                              <span className="rounded bg-indigo-100 text-indigo-800 font-bold px-1 text-[9px]">Admin</span>
                            )}
                            <span>&bull;</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs ${
                              isMe
                                ? "bg-indigo-600 text-white rounded-tr-none"
                                : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-xs text-slate-400 italic py-6">No messages yet.</div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendReply} className="border-t border-slate-200 bg-white p-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply to Admin..."
                    disabled={sendingReply}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyMessage.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40 shadow-xs"
                    title="Send Reply"
                  >
                    <FaPaperPlane size={12} />
                  </button>
                </form>
              </div>
            ) : (
              // Main Tab Navigation & Views
              <>
                {/* Tab Navigation */}
                <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5 gap-1 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab("FAQS")}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      activeTab === "FAQS"
                        ? "bg-white text-indigo-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <FaQuestionCircle className="text-xs" /> Assistant
                  </button>
                  <button
                    onClick={() => setActiveTab("TICKETS")}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      activeTab === "TICKETS"
                        ? "bg-white text-indigo-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <FaComments className="text-xs" /> My Queries
                    {tickets.length > 0 && (
                      <span className="rounded-full bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 font-bold">
                        {tickets.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("NEW")}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      activeTab === "NEW"
                        ? "bg-indigo-600 text-white shadow-xs font-bold"
                        : "text-indigo-600 hover:bg-indigo-50"
                    }`}
                  >
                    <FaPlus className="text-[10px]" /> Raise Query
                  </button>
                </div>

                {/* Tab 1: Assistant & FAQs */}
                {activeTab === "FAQS" && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
                      <p className="text-xs font-bold text-slate-900">
                        Namaste, {user?.name || user?.username || "Faculty"}!
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        I am your GVP Sahayak assistant. Check quick guides below or raise a ticket directly to the Administrative office for instant resolution.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Common FAQs & Guides</h4>
                      <div className="space-y-2">
                        {FAQ_ITEMS.map((faq, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs transition hover:border-slate-300"
                          >
                            <button
                              onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                              className="w-full p-3 text-left flex items-start justify-between gap-2"
                            >
                              <div className="flex items-start gap-2">
                                <span className="rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 shrink-0 mt-0.5">
                                  {faq.category}
                                </span>
                                <span className="text-xs font-bold text-slate-800 leading-snug">{faq.q}</span>
                              </div>
                              <span className="text-slate-400 mt-1">
                                {expandedFaq === idx ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                              </span>
                            </button>
                            {expandedFaq === idx && (
                              <div className="border-t border-slate-100 bg-slate-50/50 p-3 text-[11px] text-slate-600 leading-relaxed">
                                {faq.a}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => setActiveTab("NEW")}
                        className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 p-3 text-white text-xs font-bold shadow-xs hover:from-indigo-700 hover:to-blue-700 transition flex items-center justify-center gap-2"
                      >
                        <FaPaperPlane size={11} /> Need Admin Help? Raise a Query →
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 2: My Queries & Ticket History */}
                {activeTab === "TICKETS" && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-200">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-slate-700">My Queries ({tickets.length})</span>
                      <button
                        onClick={fetchTickets}
                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
                      >
                        <FaSync className={`text-[10px] ${loadingTickets ? "animate-spin" : ""}`} /> Refresh
                      </button>
                    </div>

                    {loadingTickets ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        <FaSync className="animate-spin inline mr-2 text-indigo-600" /> Loading your queries...
                      </div>
                    ) : tickets.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                        <FaComments className="mx-auto text-2xl text-slate-300 mb-2" />
                        <p className="text-xs font-bold text-slate-700">No queries raised yet</p>
                        <p className="text-[11px] text-slate-400 mt-1">Click below to submit your first academic or technical query.</p>
                        <button
                          onClick={() => setActiveTab("NEW")}
                          className="mt-4 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-2xs"
                        >
                          + New Query
                        </button>
                      </div>
                    ) : (
                      tickets.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => openTicketDetail(t.id)}
                          className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-400 font-mono">#{t.ticketNumber}</span>
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                                  {t.category}
                                </span>
                              </div>
                              <h5 className="text-xs font-bold text-slate-900 mt-1 leading-snug line-clamp-1">
                                {t.title}
                              </h5>
                            </div>
                            {getStatusBadge(t.status)}
                          </div>

                          {t.resolutionNotes && t.status === "RESOLVED" && (
                            <p className="mt-2 text-[11px] text-emerald-800 bg-emerald-50 rounded-lg p-1.5 font-medium line-clamp-1 border border-emerald-100">
                              ✅ {t.resolutionNotes}
                            </p>
                          )}

                          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-1.5">
                            <span>{new Date(t.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                            <span className="font-semibold text-indigo-600 hover:underline">View Chat →</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab 3: Raise New Query */}
                {activeTab === "NEW" && (
                  <form onSubmit={handleCreateTicket} className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Raise a Support Query to Admin</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Admin will review and resolve with live chat updates.</p>
                    </div>

                    {submitError && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                        {submitError}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Category</label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                        >
                          <option value="MID_EXAMS">Mid Exams Marks</option>
                          <option value="ATTENDANCE">Attendance</option>
                          <option value="ELECTIVES">Open / Electives</option>
                          <option value="TIMETABLE">Timetable</option>
                          <option value="STUDENT_DATA">Student Data</option>
                          <option value="LEAVES">Leaves / Permissions</option>
                          <option value="GENERAL">General / System</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Priority</label>
                        <select
                          value={newPriority}
                          onChange={(e) => setNewPriority(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="URGENT">Urgent</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Subject / Summary</label>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Please unlock draft marks for CSE-B BEE"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Details / Explanation</label>
                      <textarea
                        rows={4}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Describe the issue clearly (include Subject, Section, Roll Numbers if relevant)..."
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 resize-none"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingTicket}
                      className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                    >
                      {submittingTicket ? <FaSync className="animate-spin" /> : <FaPaperPlane size={11} />}
                      {submittingTicket ? "Submitting..." : "Submit to Administrator"}
                    </button>
                  </form>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
