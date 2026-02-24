# HydrocarbonMixer

Herramienta web para el **modelado de mezclas propano + isobutano**: presión de vapor, densidad del líquido y diagrama de fases P-T. Pensada para apoyo en extracciones con hidrocarburos (p. ej. extracciones de cannabis con solventes licuados).

---

## Contexto: extracciones con hidrocarburos (cannabis)

En extracciones de cannabis con solventes licuados se usan a menudo **propano (C₃H₈)** e **isobutano (i-C₄H₁₀)** puros o en mezcla. La mezcla permite ajustar:

- **Presión de trabajo**: el propano tiene mayor presión de vapor que el isobutano a la misma temperatura; más propano ⇒ mayor presión en el tanque y en la columna.
- **Poder de extracción y selectividad**: distinta afinidad por cannabinoides y ceras según la composición.
- **Temperatura de recuperación del solvente**: la presión de vapor de la mezcla determina a qué temperatura hierve a presión atmosférica.

Conocer la **presión de vapor** de la mezcla en función de la temperatura evita sobrepresiones en equipos y permite elegir condiciones seguras. La **densidad del líquido** es útil para dosificar volumen/masa de solvente. HydrocarbonMixer implementa un modelo termodinámico sencillo (ideal) para estimar estas magnitudes.

---

## Modelo

Se asume que la mezcla propano–isobutano se comporta como **mezcla ideal** en fase vapor y que la fase líquida sigue **mezcla ideal de volúmenes molares** (regla de mezcla lineal en \(V\) y en la ley de presiones parciales para la presión de vapor).

- **Presión de vapor de la mezcla**: ley de Raoult (suma de presiones parciales).
- **Volumen molar del líquido**: ecuación de Rackett para cada componente puro; mezcla por fracción molar.
- **Punto crítico de la mezcla**: regla de Kay (promedio lineal de temperatura y presión críticas con la fracción molar).

Los datos de entrada son la **fracción molar de propano** (en tanto por ciento) y, según la pestaña, la **temperatura** (ambiente para presión en tanque, o de trabajo para densidad). Las constantes (Antoine, propiedades críticas, Rackett) son las de los componentes puros.

---

## Ecuaciones

### 1. Presión de vapor (Antoine)

Para cada componente puro, la presión de vapor (en bar) es:

\[
\log_{10} P = A - \frac{B}{T + C}
\]

con \(T\) en K. Las constantes usadas son:

| Compuesto  | A      | B       | C      |
|-----------|--------|---------|--------|
| Propano   | 3.92271 | 803.997 | -26.11 |
| Isobutano | 3.93020 | 890.960 | -37.26 |

*(P en bar, T en K.)*

### 2. Presión de vapor de la mezcla (Raoult)

Con \(x\) = fracción molar de propano:

\[
P_{\text{mezcla}} = x\, P_{\text{propano}}(T) + (1-x)\, P_{\text{isobutano}}(T)
\]

El resultado se convierte internamente a psi (y a bar, kPa, atm según la unidad elegida en la app).

### 3. Volumen molar del líquido (Rackett)

Para un componente puro, el volumen molar del líquido saturado (cm³/mol) es:

\[
V = \frac{R\,T_c}{P_c}\, Z_{\text{ra}}^{1 + (1 - T_r)^{2/7}}, \qquad T_r = \frac{T}{T_c}
\]

válido para \(T < T_c\). Se usan las constantes críticas \(T_c\), \(P_c\) y el parámetro de Rackett \(Z_{\text{ra}}\) de propano e isobutano.

### 4. Densidad del líquido

- **Puro**: \(\rho = M / V\) con \(V\) de Rackett y \(M\) masa molar (g/mol); resultado en g/mL.
- **Mezcla**: mezcla ideal de volúmenes molares  
  \(V_{\text{mezcla}} = x V_1 + (1-x) V_2\),  
  \(M_{\text{mezcla}} = x M_1 + (1-x) M_2\),  
  \(\rho_{\text{mezcla}} = M_{\text{mezcla}} / V_{\text{mezcla}}\).

### 5. Punto crítico de la mezcla (Kay)

\[
T_{c,\text{mezcla}} = x\, T_{c,1} + (1-x)\, T_{c,2}, \qquad
P_{c,\text{mezcla}} = x\, P_{c,1} + (1-x)\, P_{c,2}
\]

---

## Utilidad en extracciones de cannabis

- **Presión en tanque / columna**: A una temperatura ambiente dada, la app muestra la presión de vapor de la mezcla (en la pestaña “Presión de vapor”) y la sitúa en zonas seguro / precaución / peligro según umbrales configurables. Ayuda a no superar presiones de diseño del equipo.
- **Diagrama P-T**: Ver curvas de saturación y punto crítico de la mezcla ayuda a entender en qué rango de T y P se está en líquido, vapor o supercrítico, y a planificar recuperación del solvente.
- **Densidad**: En la pestaña “Densidad” se obtiene la densidad del líquido a la temperatura elegida (p. ej. de trabajo), útil para calcular masa de solvente a partir del volumen o para comparar mezclas.
- **Composición**: Variar el % de propano en la barra de fracción molar permite ver de forma inmediata cómo cambian presión y densidad; así se puede elegir una mezcla que cumpla límites de presión y sea adecuada para el proceso.

Las presiones mostradas son estimaciones con modelo ideal; en instalaciones reales deben respetarse siempre las especificaciones del fabricante y las normativas aplicables.

---

## Cómo ejecutar el proyecto

Requisitos: [Node.js](https://nodejs.org/) y [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev
```

Abre en el navegador la URL que indique Vite (por defecto `http://localhost:5173`).

- **Build**: `pnpm run build`
- **Vista previa del build**: `pnpm run preview`

---

## Estructura del código

- **`src/chemistry.ts`**: constantes (Antoine, críticas, Rackett), funciones de presión de vapor, Rackett, densidad de mezcla y punto crítico de mezcla.
- **`src/main.ts`**: lógica de la UI, gráficos (Chart.js), conversión de unidades y actualización de las pestañas.
- **`src/style.css`**: estilos y variables de tema.
- **`index.html`**: estructura de la aplicación (header, barra de composición, pestañas Presión de vapor y Densidad, modal de configuración).
