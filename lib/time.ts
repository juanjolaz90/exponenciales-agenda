/** Hora actual en ms. Separada para que los componentes de servidor no llamen a Date.now() en el render. */
export const nowMs = () => Date.now();
