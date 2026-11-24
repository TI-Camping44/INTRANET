"use client";

import {
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Contact,
  FileText,
  History,
  KeyRound,
  Home,
  LayoutDashboard,
  LogIn,
  LayoutGrid,
  ListChecks,
  MessageSquareWarning,
  Search,
  ShieldAlert,
  ShieldCheck,
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
  LogIn,
  Search,
  FileText,
  TriangleAlert,
  GitBranch,
  ListChecks,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  TrendingUp,
  Smile,
  Users,
  Truck,
  Wrench,
  UserCog,
  History,
  CalendarCheck,
  KeyRound,
  ClipboardList,
};

export function Icono({ nombre, className }: { nombre: string; className?: string }) {
  const Componente = ICONOS[nombre] ?? FileText;
  return <Componente className={className} />;
}
