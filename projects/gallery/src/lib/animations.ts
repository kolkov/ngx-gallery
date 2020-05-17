import {animate, animation, group, query, style} from '@angular/animations';

export const slideInOutAnimation = animation([
  group([
    query(':enter', [
      style({
        transform: 'translateX({{ from }})'
      }),
      animate('{{ timings }}', style(
        {transform: 'translateX(0)'}))
    ], { optional: true }),
    query(':leave', [
      animate('{{ timings }}', style(
        {
          transform: 'translateX({{ to }})'
      }))
    ], { optional: true }),
  ])
]);

export const fadeInOutAnimation = animation([
  group([
    query(':enter', [
      style({
        opacity:'0'
      }),
      animate('{{ timings }}', style(
        {opacity:'100%'}))
    ], { optional: true }),
    query(':leave', [
      animate('{{ timings }}', style(
        {
          opacity:'0'
        }))
    ], { optional: true }),
  ])
]);
