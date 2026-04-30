import { Component, OnDestroy } from '@angular/core';
import { NavController } from '@ionic/angular';
// Assuming you're using html5-qrcode or a similar web-friendly scanner for testing
// In a real device environment, you might use @capacitor-community/barcode-scanner
import { Html5QrcodeScanner } from 'html5-qrcode';

@Component({
  selector: 'app-qr-scanner',
  templateUrl: './qr-scanner.component.html',
  styleUrls: ['./qr-scanner.component.scss']
})
export class QrScannerComponent implements OnDestroy {
  scanner: any;

  constructor(private navCtrl: NavController) {}

  startScanner() {
    this.scanner = new Html5QrcodeScanner(
      "reader", 
      { fps: 10, qrbox: {width: 250, height: 250} }, 
      false
    );

    this.scanner.render((decodedText: string) => {
      this.onScanSuccess(decodedText);
    }, this.onScanFailure);
  }

  onScanSuccess(decodedText: string) {
    // Assuming the QR code contains just the roomId or a deep link like 'app://room/123'
    console.log(`Scan result: ${decodedText}`);
    
    // Stop scanning
    this.scanner.clear();
    
    // Navigate directly to that room's booking page
    const roomId = decodedText.split('/').pop() || decodedText;
    this.navCtrl.navigateForward(`/room-booking/${roomId}`);
  }

  onScanFailure(error: any) {
    // handle scan failure, usually better to ignore and keep scanning
    console.warn(`Code scan error = ${error}`);
  }

  ngOnDestroy() {
    if (this.scanner) {
      this.scanner.clear();
    }
  }
}
