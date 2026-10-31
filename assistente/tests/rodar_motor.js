// Roda o motor.js no Node para o teste de paridade com o Python: lê [{pergunta, projeto}] do stdin.
const fs = require('fs');
const path = require('path');
const Motor = require('../motor.js');
const motor = Motor(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'indice.json'), 'utf8')));
const perguntas = JSON.parse(fs.readFileSync(0, 'utf8'));
const saida = perguntas.map(({ pergunta, projeto }) => {
  const r = motor.buscar(pergunta, projeto, 3);
  return { ids: r.res.map((x) => x.t.id), fora: r.fora, tema: r.tema, prob: r.prob, toks: r.toks };
});
process.stdout.write(JSON.stringify(saida));
