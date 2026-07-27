# Normativas Latinoamericanas de Urbanización

Este documento recopila las normativas urbanísticas de uso común en América Latina que han sido integradas (o están en proceso de integración) en la aplicación **Desarrollo Urbano**. Estas reglas sirven para regular el ordenamiento territorial y garantizar que las edificaciones sean funcionales, seguras y estéticas.

## 1. COS (Coeficiente de Ocupación del Suelo)
* **¿Qué es?** Es el porcentaje máximo del terreno que puede ser ocupado o "cubierto" por la huella física de un edificio.
* **Sinónimos:** FOS (Factor de Ocupación del Suelo - Argentina), Índice de Ocupación (Colombia).
* **Ejemplo:** En un terreno de 1,000 m², un COS del 60% significa que el edificio solo puede tocar el piso en un área de 600 m². El resto debe quedar libre (para circulaciones, retiros o áreas verdes).
* **En la App:** Se calcula dividiendo la base construida total (ocupación) entre el área del lote.

## 2. CUS (Coeficiente de Utilización del Suelo)
* **¿Qué es?** Es un multiplicador que determina el total máximo de metros cuadrados que se pueden construir en todos los niveles/pisos sumados, en relación con el área del terreno.
* **Sinónimos:** FOT (Factor de Ocupación Total - Argentina), Coeficiente de Constructibilidad (Chile), Índice de Construcción (Colombia).
* **Ejemplo:** En un lote de 1,000 m², un CUS de 2.5 permite construir un total de 2,500 m² repartidos en varios pisos.
* **En la App:** Se calcula sumando el área de cada piso del edificio y dividiéndola entre el tamaño del terreno base.

## 3. Altura Máxima Permitida
* **¿Qué es?** El límite vertical que no puede rebasar ninguna edificación dentro del terreno. Puede estar dictado en metros absolutos o en cantidad máxima de niveles.
* **Variantes:** Rasante o Plano Límite (un plano inclinado que evita que el edificio haga sombra perpetua a la calle).
* **En la App:** Se define un valor máximo en las propiedades del polígono del terreno. Si un edificio dentro del polígono supera esa altura, el dashboard alerta de la violación en color rojo.

## 4. CAS (Coeficiente de Absorción del Suelo / Área Verde Mínima)
* **¿Qué es?** El porcentaje mínimo del terreno que debe dejarse completamente libre de cualquier tipo de techo, sótano o pavimento impermeable para permitir que el agua de lluvia se filtre al subsuelo.
* **Sinónimos:** FIS (Factor de Impermeabilización del Suelo - inverso), Área Libre Permeable.
* **En la App:** Se configura un porcentaje mínimo. El motor calcula toda el área designada como parque o masa de agua dentro del terreno. Si no se alcanza el mínimo exigido, el sistema marca una violación.

## 5. Retiros o Aislamientos (En desarrollo)
* **¿Qué es?** Es la franja obligatoria que debe quedar libre entre la fachada del edificio y los límites físicos (linderos) del terreno.
* **Tipos:**
  * **Frontal:** Hacia la calle (suele ser el más amplio para permitir ensanchamientos de banquetas a futuro).
  * **Lateral:** Hacia los terrenos vecinos (garantiza ventilación e iluminación, y reduce riesgo de incendios).
  * **Posterior:** Al fondo del terreno.
* **Sinónimos:** Distanciamientos (Chile), Aislamientos (Colombia), Remetimientos (México).
* **En la App:** Mediante la librería **Turf.js**, el terreno define distancias y se genera un "búfer interior" (área construible). Cualquier edificio cuyas esquinas se salgan de esta área marcará una alerta normativa.
