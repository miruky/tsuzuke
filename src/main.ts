import './style.css';
import { mountApp } from './app';
import { HabitStore } from './lib/habits';

const root = document.getElementById('app');
if (root !== null) {
  mountApp(root, new HabitStore(localStorage));
}
