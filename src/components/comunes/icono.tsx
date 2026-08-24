"use client";

import {
  ClipboardCheck,
  FileText,
  History,
  LayoutDashboard,
  Search,
  ShieldAlert,
  Smile,
  TrendingUp,
  TriangleAlert,
  Truck,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Resolucion de iconos por nombre. Se mantiene un mapa explicito en lugar
 * de una importacion dinamica para que el paquete final no arrastre toda
 * la libreria de iconos.
 */
const ICONOS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Search,
  FileText,
  TriangleAlert,
  ShieldAlert,
  ClipboardCheck,
  TrendingUp,
  Smile,
  Users,
  Truck,
  Wrench,
  UserCog,
  History,
};

export function Icono({ nombre, className }: { nombre: string; className?: string }) {
  const Componente = ICONOS[nombre] ?? FileText;
  return <Componente className={className} />;
}
