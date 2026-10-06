package com.example.employee;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@SpringBootApplication
@RestController
public class EmployeeApplication {

    private final JdbcTemplate jdbcTemplate;

    public EmployeeApplication(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public static void main(String[] args) {
        SpringApplication.run(EmployeeApplication.class, args);
    }

    @GetMapping("/health")
    public Map<String, String> health() {

        return Map.of(
            "status", "UP",
            "service", "springboot"
        );
    }

    @GetMapping("/employees")
    public List<Map<String, Object>> employees() {

        return jdbcTemplate.queryForList(
            "SELECT id, name FROM employees"
        );
    }
}
