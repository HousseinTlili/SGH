package com.sgh.patient.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.InputStream;
import java.util.Collections;
import java.util.Map;

@RestController
public class DocsController {

    private static final Logger log = LoggerFactory.getLogger(DocsController.class);

    private Map<String, Object> openApiSpec = Collections.emptyMap();

    @PostConstruct
    public void init() {
        try {
            ClassPathResource resource = new ClassPathResource("openapi.yaml");
            if (resource.exists()) {
                YAMLMapper yamlMapper = new YAMLMapper();
                try (InputStream is = resource.getInputStream()) {
                    openApiSpec = yamlMapper.readValue(is, Map.class);
                }
            }
        } catch (Exception e) {
            log.warn("Could not load openapi.yaml for /openapi.json: {}", e.getMessage());
        }
    }

    @GetMapping(value = "/openapi.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getOpenApiJson() {
        return ResponseEntity.ok(openApiSpec);
    }
}
