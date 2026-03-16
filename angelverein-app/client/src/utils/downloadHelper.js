// Hilfsfunktion für Datei-Downloads aus dem Browser.
// Löst einen Download-Dialog aus, ohne die Seite zu verlassen.
// blob: die Rohdaten der Datei
// dateiname: der vorgeschlagene Dateiname für den Speichern-Dialog
export function blobAlsDateiSpeichern(blob, dateiname) {
  // Temporäre URL erstellen, die auf die Blob-Daten zeigt
  const url = URL.createObjectURL(blob);
  // Unsichtbaren Link erstellen und anklicken – das löst den Download aus
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  // Aufräumen: URL freigeben und Link wieder entfernen
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
