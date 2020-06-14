import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {

  constructor(private http: HttpClient) { }

  getImage() {
    return this.http.get('/assets/img/gallery/image.json');
  }

}
