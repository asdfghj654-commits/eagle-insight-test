/**
 * Commander View Page
 * 
 * מסך מפקד גף טכני
 * Fleet Readiness + Risk Ownership + Accountability
 * 
 * Note: Header is provided by AppLayout, this is just the content
 */

import React from 'react';
import { CommanderDashboard } from '@/components/dashboard/CommanderDashboard';

const CommanderView: React.FC = () => {
  return <CommanderDashboard />;
};

export default CommanderView;
