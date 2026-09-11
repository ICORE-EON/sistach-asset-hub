# Sistach Asset Guardian

PRD LOVABLE – SISTACH ASSET & MAINTENANCE MANAGEMENT PLATFORM

1. ROL DEL ASISTENTE (META PROMPTING)

Eres un desarrollador de software experto de clase mundial en React, TypeScript, Tailwind CSS, ShadCN, Supabase, PostgreSQL, Edge Functions y el entorno nativo de Lovable.

Debes construir una aplicación SaaS PWA (Progressive Web App) profesional, escalable, multiempresa y mobile-first para la gestión integral de activos, mantenimiento preventivo, incidencias y documentación de la empresa.

La aplicación debe priorizar:

Simplicidad de uso

Rapidez de ejecución en móvil

UX extremadamente intuitiva

Diseño corporativo alineado con Sistach

Escalabilidad futura

Antes de generar código, analiza completamente este documento y confirma la comprensión funcional del proyecto.

2. DESCRIPCIÓN GENERAL Y VISIÓN

Nombre provisional

Sistach Asset & Maintenance Manager

Objetivo

Crear una plataforma única para:

Inventario de equipos

Planificación de mantenimientos

Gestión documental

Seguimiento de incidencias

Control de vencimientos

Generación de certificados

Seguimiento de responsables

Usuarios objetivo

Administradores

Responsable del Sistema

Gerencia

Personal operativo

Auditores

MVP

Permitir gestionar:

Equipos PCI

Botiquines

Vehículos

Con:

Inventario completo

Revisiones

Checklists dinámicos

Incidencias

Certificados PDF

Dashboard

Calendario

Alertas automáticas

3. STACK Y RESTRICCIONES TÉCNICAS

Frontend

React

TypeScript

Vite

Tailwind CSS

ShadCN UI

React Query

React Hook Form

Zod

Backend

Supabase

PostgreSQL

Supabase Auth

Supabase Storage

Edge Functions

Emails

Fase 1:

Resend

Fase 2:

Microsoft 365

Outlook

Teams

Certificados PDF

React PDF
o

PDFMake

Internacionalización

Idiomas:

Castellano

Catalán

Aplicación

PWA instalable

Compatible con:

Android

iPhone

Tablet

Desktop

4. MULTIEMPRESA

La aplicación debe ser multiempresa desde el inicio.

Tabla Company.

Cada empresa tendrá:

Usuarios

Ubicaciones

Equipos

Revisiones

Certificados

Incidencias

totalmente aislados mediante RLS.

5. ARQUITECTURA DE DATOS

Empresas

Company

id

name

cif

address

logo

active

Usuarios

Users

id

company_id

name

email

phone

role

active

Roles

Administrator

SystemManager

Manager

Employee

Auditor

Ubicaciones

Locations

id

company_id

parent_location_id

code

name

type

active

Permitir jerarquía infinita.

Ejemplo:

Puerto BCN
→ Terminal A

Puerto BCN
→ Terminal B

Vehículo
→ Matrícula

6. EQUIPOS

Tabla AssetTypes

Configurables.

Iniciales:

Extintor

BIE

Botiquín

Vehículo

Debe permitir crear nuevos tipos.

Assets

id

company_id

asset_type_id

location_id

responsible_user_id

code

qr_code

description

photo

status

active

Estados:

Active

Inactive

Retired

7. VEHÍCULOS

Tabla Vehicles

Campos configurables.

Ejemplos:

matrícula

marca

modelo

kilometraje

fecha ITV

fecha seguro

ADR

tacógrafo

permiso circulación

Relación:

VehicleAssets

Permite asociar:

extintores

botiquines

Estado global:

Verde

Amarillo

Rojo

Automático.

8. GESTIÓN DOCUMENTAL

Tabla Documents

Tipos:

Seguro

ITV

Certificado

Contrato

Foto

Evidencia

Otro

Archivos almacenados en Supabase Storage.

Un documento puede estar asociado a:

Equipo

Revisión

Certificado

Incidencia

Vehículo

9. PLANES DE MANTENIMIENTO

Tabla MaintenancePlans

Configurables.

Campos:

Nombre

Tipo equipo

Periodicidad

Unidad tiempo

Activo

Ejemplos:

Revisión trimestral extintores
→ 3 meses

Revisión anual PCI
→ 12 meses

Botiquines
→ 12 meses

10. CHECKLISTS DINÁMICOS

Sistema totalmente configurable.

ChecklistTemplates

id

name

asset_type

maintenance_type

ChecklistQuestions

question

order

required

generate_incident

answer_type

Tipos:

OK

NO_OK

NOT_APPLICABLE

TEXT

DATE

El administrador podrá crear y modificar checklists sin programar.

11. REVISIONES

MaintenanceSessions

Representa una revisión completa.

Ejemplo:

Revisión trimestral Oficina Berga Enero 2026

Estados:

Draft

In Progress

Pending Closure

Completed

Debe poder reabrirse.

MaintenanceItems

Equipo concreto revisado.

Guardar:

Respuestas checklist

Incidencias

Fotos

Observaciones

12. INCIDENCIAS

Tabla Incidents

Campos:

title

description

asset

location

responsible

priority

status

due_date

Prioridades:

Low

Medium

High

Critical

Estados:

Open

In Progress

Waiting External

Solved

Closed

Permitir:

comentarios

fotografías

documentos

historial

13. CERTIFICADOS

Generación automática PDF.

Plantillas configurables.

CertificateTemplates

Nombre

Tipo

HTML template

Certificates

id

revision_id

template_id

pdf_file

signed_pdf_file

status

Estados:

Generated

Sent

Signed

Archived

Contenido:

Logo empresa

Datos técnico

Fecha

Equipos revisados

Resultado

Incidencias

Fotografías

Firma técnico

Guardar copia automática.

14. FIRMA DIGITAL

Fase 1

Firma manuscrita en pantalla

Usuario autenticado

Fase 2

Preparar integración:

Signaturit

15. QR

Cada equipo tendrá QR automático.

Acciones QR:

Abrir ficha equipo

Realizar revisión

Consultar incidencias

Ver documentación

Escaneo desde móvil.

16. NOTIFICACIONES

Motor automático.

Tipos:

Próxima revisión

Revisión vencida

Incidencia abierta

Incidencia crítica

Certificado pendiente

Configuración:

30 días
15 días
7 días
1 día
Vencido

Configurables.

17. DASHBOARD EJECUTIVO

Indicadores:

Equipos totales

Equipos con incidencias

Revisiones pendientes

Revisiones vencidas

Certificados pendientes

Gráficos:

Estado equipos

Incidencias

Revisiones mensuales

18. DASHBOARD OPERATIVO

Mis tareas

Revisiones asignadas

Incidencias asignadas

Próximos vencimientos

Equipos con incidencias

Acciones rápidas:

Nueva revisión

Nueva incidencia

Buscar equipo

Escanear QR

19. CALENDARIO

Vistas:

Día

Semana

Mes

Agenda

Mostrar:

Revisiones

ITV

Seguros

Certificados

Incidencias con vencimiento

Filtros:

Responsable

Ubicación

Tipo equipo

20. BÚSQUEDA GLOBAL

Buscador omnibox.

Permitir buscar:

Equipos

Matrículas

Certificados

Incidencias

Ubicaciones

Responsables

Resultados instantáneos.

21. AUDITORÍA

Registrar:

Usuario

Acción

Fecha

Valor anterior

Valor nuevo

Para cualquier modificación.

22. GEOLOCALIZACIÓN

Opcional.

Guardar:

Latitud

Longitud

Fecha

cuando se realiza una revisión.

23. IMPORTACIÓN Y EXPORTACIÓN

Importación:

CSV

Excel

Exportación:

Excel

PDF

Aplicable a:

Equipos

Revisiones

Certificados

Incidencias

24. PERMISOS

Administrator

Acceso total.

System Manager

Acceso completo funcional.

No puede modificar configuración técnica.

Manager

Consulta global.

Puede aprobar y revisar.

Employee

Solo:

Equipos asignados

Revisiones asignadas

Incidencias asignadas

Auditor

Solo lectura.

25. DISEÑO UI/UX

Inspiración visual:

Sitio web corporativo Sistach.

Características:

Profesional

Moderna

Minimalista

Mobile-first

Muy rápida

Componentes:

Dashboard cards

Data tables

Calendarios

Timeline incidencias

Formularios rápidos

Colores:

Tomar automáticamente branding corporativo y logo de Sistach.

26. ROADMAP FUTURO

Preparar arquitectura para:

Signaturit

Teams

Outlook

OpenAI

Push notifications

Modo offline

Auditorías ISO

Nuevos tipos de activos

Nuevos tipos de mantenimiento

27. ALCANCE MVP

Incluido

Multiempresa

Usuarios

Roles

Ubicaciones

Inventario

PCI

BIE

Botiquines

Vehículos

Revisiones

Checklists

Incidencias

Certificados PDF

Firma básica

QR

Dashboard

Calendario

Notificaciones

Gestión documental

Importación/exportación

Multidioma

Excluido

Signaturit

Teams

Outlook

App Store

Google Play

Offline completo

IA operativa

28. NOTA FINAL PARA LOVABLE

Antes de generar código:

Analizar completamente este documento.

Confirmar entendimiento funcional.

Proponer estructura de tablas Supabase.

Proponer arquitectura de carpetas.

Crear primero la base de datos.

Crear autenticación y permisos.

Crear dashboard.

Crear inventario.

Crear revisiones.

Crear incidencias.

Crear certificados.

Crear notificaciones.

No simplificar funcionalidades descritas en este documento.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sistach-asset-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3fcaf51b-629d-4f6b-a2ff-e32ccfac0da5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
