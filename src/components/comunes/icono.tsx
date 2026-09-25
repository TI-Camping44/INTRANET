"use client";

import {
  ClipboardCheck,
  Contact,
  FileText,
  History,
  Home,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Search,
  ShieldAlert,
  Smile,
  TrendingUp,
  GitBranch,
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
  Home,
  Contact,
  LayoutGrid,
  LayoutDashboard,
  Search,
  FileText,
  TriangleAlert,
  GitBranch,
  ListChecks,
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
