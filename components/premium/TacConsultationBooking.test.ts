import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import TacConsultationBooking from './TacConsultationBooking';

it('shows the Luis review offer only on a flagship booking journey',()=>{
 const supporting=renderToStaticMarkup(React.createElement(TacConsultationBooking,{assessmentId:'test',locale:'en'}));
 const flagship=renderToStaticMarkup(React.createElement(TacConsultationBooking,{assessmentId:'test',locale:'en',flagshipReview:true}));
 const direct=renderToStaticMarkup(React.createElement(TacConsultationBooking,{assessmentId:'test',locale:'en',consultationOnly:true,flagshipReview:true}));
 expect(supporting).not.toContain('30-minute Report Card Review with Luis Perez');
 expect(direct).not.toContain('30-minute Report Card Review with Luis Perez');
 expect(flagship).toContain('30-minute Report Card Review with Luis Perez');
 expect(flagship).toContain('no obligation to buy');
});
