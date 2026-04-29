"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function RotatingCube() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 3;

    const geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const material = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      metalness: 0.4,
      roughness: 0.3,
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0xa5b4fc, linewidth: 1 })
    );
    cube.add(edges);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x818cf8, 2, 10);
    pointLight.position.set(-3, -2, 2);
    scene.add(pointLight);

    // Drag state
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    // Inertia
    let velX = 0;
    let velY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
      velX = 0;
      velY = 0;
      mount.style.cursor = "grabbing";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      velX = dy * 0.01;
      velY = dx * 0.01;
      cube.rotation.x += velX;
      cube.rotation.y += velY;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
      mount.style.cursor = "grab";
    };

    // Touch support
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      isDragging = true;
      prevX = t.clientX;
      prevY = t.clientY;
      velX = 0;
      velY = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const t = e.touches[0];
      const dx = t.clientX - prevX;
      const dy = t.clientY - prevY;
      velX = dy * 0.01;
      velY = dx * 0.01;
      cube.rotation.x += velX;
      cube.rotation.y += velY;
      prevX = t.clientX;
      prevY = t.clientY;
    };

    const onTouchEnd = () => { isDragging = false; };

    mount.style.cursor = "grab";
    mount.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (!isDragging) {
        // Auto-rotate when idle, blend with inertia
        velX *= 0.92;
        velY *= 0.92;
        cube.rotation.x += velX + 0.005;
        cube.rotation.y += velY + 0.008;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      mount.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      mount.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
}
