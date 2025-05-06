import { promisify } from 'util';
import { exec } from 'child_process';
const execAsync = promisify(exec);

export async function xfid() {
    const { stdout } = await execAsync('pwgen 5 -A');
    const rfid = stdout.trim().split(' ')[0];
    return rfid
}