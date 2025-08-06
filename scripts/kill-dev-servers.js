#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function killProcessesOnPorts(ports) {
  console.log(`Checking for processes on ports: ${ports.join(', ')}`);
  
  for (const port of ports) {
    try {
      // Find process using the port
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      const pids = stdout.trim().split('\n').filter(Boolean);
      
      if (pids.length > 0) {
        console.log(`Found process(es) on port ${port}: ${pids.join(', ')}`);
        
        // Kill each process
        for (const pid of pids) {
          try {
            await execAsync(`kill -9 ${pid}`);
            console.log(`  ✅ Killed process ${pid}`);
          } catch (err) {
            console.log(`  ⚠️  Could not kill process ${pid}: ${err.message}`);
          }
        }
      } else {
        console.log(`No process found on port ${port}`);
      }
    } catch (err) {
      // No process on this port (lsof returns non-zero when no process found)
      console.log(`No process found on port ${port}`);
    }
  }
}

// Kill processes on common dev ports
const devPorts = [4321, 4322, 4323];

killProcessesOnPorts(devPorts)
  .then(() => {
    console.log('\n✅ Done! All dev server ports are now free.');
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });