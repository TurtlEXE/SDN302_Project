import React from 'react';
import { PublicLayout } from './PublicLayout.jsx';

/**
 * Customer layout reuses PublicLayout shell with personalized actions for authenticated customers
 */
export function CustomerLayout() {
  return <PublicLayout />;
}

