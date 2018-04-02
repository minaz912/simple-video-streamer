import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as winston from 'winston';
import {json} from 'body-parser';
import * as morgan from 'morgan';
import {Express, Request, Response} from 'express';

const PORT: number = 1337;

/**
 * Basic configurations of all middleware libraries are applied here.
 */
export class Server {
  public static start() {
    let app: Express = express();

    // Decode payload as json with body-parser
    app.use(json());

    // Apply morgan request logger
    app.use(morgan('combined'));

    // Set headers for CORS requests
    // TODO: Adjust these settings to your security concerns!
    app.use((req: Request, res: Response, next: any) => {
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:*');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS, PUT, PATCH, DELETE',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'X-Requested-With,content-type,authorization',
      );
      next();
    });

    Server.setupRoutes(app);
    app.listen(PORT, () =>
      winston.log('info', '--> Server successfully started at port %d', PORT),
    );
  }

  /**
   * Setup all endpoints of your API. You can extend this method or if there are many different routes,
   * it might be better to move this to a separate class.
   */
  private static setupRoutes(app: Express): void {
    app.get('/vid', (req: Request, res: Response) => {
      // res.status(200).send('Server running ...');
      const { filename } = req.query;
      const file = path.resolve(VIDEOS_DIR, filename);
      fs.stat(file, (err, stats) => {
        if (err) {
          if (err.code === 'ENOENT') {
            // 404 Error if file not found
            return res.sendStatus(404);
          }
          res.end(err);
        }
        const range = req.headers.range;
        if (!range) {
          // 416 wrong range
          return res.sendStatus(416);
        }
        const positions: string[] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(positions[0], 10);
        const total = stats.size;
        let end = positions[1] ? parseInt(positions[1], 10) : total - 1;
        let chunkSize =  (end - start ) + 1;
        const maxChunk = 1024 * 1024; // 1 MB at a time

        if (chunkSize > maxChunk) {
          end = start + maxChunk - 1;
          chunkSize = (end - start) + 1;
        }

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': 'video/mp4'
        });

        const stream = fs.createReadStream(file, { start, end })
          .on('open', () => stream.pipe(res))
          .on('error', (err) => res.end(err));
      });
    });

    app.get('/', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'index.html'));
    })
  }
}

Server.start();
