-- Remove the unchanged default free-text field only. Custom questions and report snapshots remain intact.
UPDATE intervention_form
SET questions=(SELECT json_group_array(json(value)) FROM json_each(intervention_form.questions)
 WHERE NOT(json_extract(value,'$.id')='parts' AND json_extract(value,'$.label')='Pièces remplacées'
   AND json_extract(value,'$.type')='textarea' AND COALESCE(json_extract(value,'$.required'),0)=0)),version=version+1
WHERE id='global' AND EXISTS(SELECT 1 FROM json_each(intervention_form.questions)
 WHERE json_extract(value,'$.id')='parts' AND json_extract(value,'$.label')='Pièces remplacées'
   AND json_extract(value,'$.type')='textarea' AND COALESCE(json_extract(value,'$.required'),0)=0);
